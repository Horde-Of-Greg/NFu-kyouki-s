import fs from "fs";
import gulp, { dest, src } from "gulp";
import upath from "upath";
import buildConfig from "#buildConfig";
import {
	modDestDirectory,
	modpackManifest,
	overridesFolder,
	rootDirectory,
	sharedDestDirectory,
	tempDirectory,
} from "#globals";
import { deleteAsync } from "del";
import { FileDef } from "#types/fileDef.ts";
import {
	downloadOrRetrieveFileDef,
	promiseStream,
} from "#utils/util.ts";
import transformVersion from "./transformVersion.ts";
import {
	updateFilesBuildSetup,
	updateLabsVersion,
} from "../misc/transformFiles.ts";
import { transformQuestBook } from "./quest.ts";

async function sharedCleanUp() {
	await deleteAsync(upath.join(sharedDestDirectory, "*"), { force: true });
	await deleteAsync(upath.join(tempDirectory, "*"), { force: true });
}

/**
 * Checks and creates all necessary directories so we can build everything safely.
 */
async function createSharedDirs() {
	if (!fs.existsSync(sharedDestDirectory)) {
		await fs.promises.mkdir(sharedDestDirectory, { recursive: true });
	}

	if (!fs.existsSync(tempDirectory)) {
		await fs.promises.mkdir(tempDirectory, { recursive: true });
	}
}

/**
 * Copies modpack overrides.
 */
async function copyOverrides() {
	// Copy, not Symlink, so we can transform the files as we wish
	return promiseStream(
		src(buildConfig.copyToSharedDirGlobs, {
			cwd: upath.join(rootDirectory),
			encoding: false,
		}).pipe(dest(upath.join(sharedDestDirectory, overridesFolder))),
	);
}

/**
 * Copies Modpack Pack Mode Switcher Scripts.
 */
async function copyPackModeSwitchers() {
	return promiseStream(
		src(buildConfig.packModeSwitcherGlobs, {
			cwd: upath.join(rootDirectory),
		}).pipe(dest(upath.join(sharedDestDirectory, overridesFolder))),
	);
}

/**
 * Fetch external dependencies and remove the field from the manifest file.
 */
async function fetchExternalDependencies() {
	const dependencies = modpackManifest.externalDependencies;
	if (dependencies) {
		const destDirectory = upath.join(modDestDirectory, "mods");

		if (!fs.existsSync(destDirectory)) {
			await fs.promises.mkdir(destDirectory, { recursive: true });
		}

		// Map dependencies to FileDefs.
		const depDefs: FileDef[] = dependencies.map((dep) => {
			return {
				url: dep.url,
				hashes: [
					{
						hashes: [dep.sha],
						id: "sha1",
					},
				],
			};
		});

		delete modpackManifest.externalDependencies;

		await Promise.all(
			depDefs.map(async (depDef) => {
				const dest = upath.join(destDirectory, upath.basename(depDef.url));
				const cachePath = (await downloadOrRetrieveFileDef(depDef)).cachePath;

				return fs.promises.symlink(upath.resolve(dest, cachePath), dest);
			}),
		);
	}
}

/**
 * Either fetches the Changelog File, or makes one. Does nothing if 'SKIP_CHANGELOG' is set to a truthy value.
 */

const updateBuildLabsVersion = async () => {
	await updateLabsVersion(sharedDestDirectory);
};

export default gulp.series(
	sharedCleanUp,
	createSharedDirs,
	copyOverrides,
	copyPackModeSwitchers,
	fetchExternalDependencies,
	updateFilesBuildSetup,
	updateBuildLabsVersion,
	transformVersion,
	transformQuestBook,
);

export const typoBuild = gulp.series(
	sharedCleanUp,
	createSharedDirs,
	copyOverrides,
	transformQuestBook,
);
