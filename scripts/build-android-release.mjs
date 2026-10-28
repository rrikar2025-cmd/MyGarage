#!/usr/bin/env node

import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const versionFile = join(projectRoot, 'app-version.json');
const lockFile = join(projectRoot, '.android-release.lock');
const androidDirectory = join(projectRoot, 'android');

const readVersion = () => {
  const version = JSON.parse(readFileSync(versionFile, 'utf8'));

  if (!/^[0-9A-Za-z.+-]+$/.test(version.versionName)) {
    throw new Error(`Invalid versionName in app-version.json: ${version.versionName}`);
  }

  if (!Number.isInteger(version.androidVersionCode) || version.androidVersionCode < 1) {
    throw new Error(`androidVersionCode must be a positive integer: ${version.androidVersionCode}`);
  }

  return version;
};

let lockDescriptor;

try {
  lockDescriptor = openSync(lockFile, 'wx');

  const currentVersion = readVersion();
  const nextVersionCode = currentVersion.androidVersionCode + 1;
  const apkName = `MyGarage-${currentVersion.versionName}(${nextVersionCode})-release.apk`;
  const apkPath = join(androidDirectory, 'app', 'build', 'outputs', 'apk', 'release', apkName);

  console.log(`Building MyGarage ${currentVersion.versionName} (${nextVersionCode})...`);

  const prebuild = spawnSync(
    join(projectRoot, 'node_modules', '.bin', 'expo'),
    ['prebuild', '--platform', 'android'],
    { cwd: projectRoot, stdio: 'inherit' },
  );

  if (prebuild.error) throw prebuild.error;
  if (prebuild.status !== 0) {
    throw new Error(`Expo Android prebuild failed with exit code ${prebuild.status}.`);
  }

  const build = spawnSync(
    join(androidDirectory, 'gradlew'),
    [
      ':app:clean',
      ':app:assembleRelease',
      `-PmyGarageVersionName=${currentVersion.versionName}`,
      `-PmyGarageVersionCode=${nextVersionCode}`,
    ],
    { cwd: androidDirectory, stdio: 'inherit' },
  );

  if (build.error) throw build.error;
  if (build.status !== 0) {
    throw new Error(`Android release build failed with exit code ${build.status}.`);
  }
  if (!existsSync(apkPath)) {
    throw new Error(`Release build finished, but the expected APK was not found: ${apkPath}`);
  }

  const nextVersion = {
    ...currentVersion,
    androidVersionCode: nextVersionCode,
  };
  const temporaryVersionFile = `${versionFile}.tmp`;
  writeFileSync(temporaryVersionFile, `${JSON.stringify(nextVersion, null, 2)}\n`);
  renameSync(temporaryVersionFile, versionFile);

  console.log(`\nRelease created: ${apkPath}`);
  console.log(`Next Android release will use versionCode ${nextVersionCode + 1}.`);
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  if (lockDescriptor !== undefined) {
    closeSync(lockDescriptor);
    unlinkSync(lockFile);
  }
}
