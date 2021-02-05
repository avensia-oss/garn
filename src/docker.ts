import * as path from 'path';
import * as fs from 'fs';
import { spawn, isInPath } from './exec';
import * as log from './logging';
import * as version from './version';

export async function run(args: string[]) {
  await verifyDockerInPath();
  return spawn('docker', ['run', ...args]);
}

export async function build(tag: string, dockerFilePath: string, context?: string) {
  await verifyDockerInPath();
  if (!fs.lstatSync(dockerFilePath).isFile()) {
    throw new Error('Path to Dockerfile is not a file');
  }
  if (path.basename(dockerFilePath) !== 'Dockerfile') {
    throw new Error('Path to Dockerfile is not a Dockerfile');
  }
  if (!context) {
    context = path.dirname(dockerFilePath);
  }
  const currentVersion = await version.currentVersion();
  return spawn(
    'docker',
    [
      'build',
      '--no-cache',
      '--build-arg',
      `Version=${currentVersion.version}`,
      '--build-arg',
      `CommitId=${currentVersion.sha1}`,
      '--tag',
      tag,
      '-f',
      dockerFilePath,
      '.',
    ],
    { cwd: context },
  );
}

export async function tag(image: string, tag: string) {
  await verifyDockerInPath();
  return spawn('docker', ['tag', image, tag]);
}

export async function push(registry: string, image: string) {
  await verifyDockerInPath();
  return spawn('docker', ['push', `${registry}/${image}`]);
}

export async function login(registry: string, username: string, password: string) {
  await verifyDockerInPath();
  return spawn('docker', ['login', '--username', username, '--password', password, registry]);
}

export async function logout(registry: string) {
  await verifyDockerInPath();
  return spawn('docker', ['logout', registry]);
}

export async function exec(container: string, command: string, args: string[]) {
  await verifyDockerInPath();
  return spawn('docker', ['exec', '-it', container, command, ...args]);
}

export async function createVolume(name: string) {
  await verifyDockerInPath();
  return spawn('docker', ['volume', 'create', name]);
}

export async function remove(container: string) {
  await verifyDockerInPath();
  try {
    await spawn('docker', ['stop', container], { stdio: 'pipe' });
    await spawn('docker', ['rm', container], { stdio: 'pipe' });
  } catch (e) {
    log.verbose(`Error deleting container '${container}'`);
    log.verbose(String(e));
  }
}

async function verifyDockerInPath() {
  if (!(await isInPath('docker'))) {
    throw new Error(
      `'docker' is not in your PATH, you either need to install docker (Docker Desktop on Windows) or add it to your PATH`,
    );
  }
}
