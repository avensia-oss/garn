import os from 'os';
import childProcess from 'child_process';
import path from 'path';
import * as exec from './exec.mts';
import { getProjectPath } from './index.mts';

export async function runScript(script: string, args: string[] = []) {
  return runPnpm(['run', script, ...args]);
}

export async function runExec(script: string, args: string[] = []) {
  return runPnpm(['exec', script, ...args]);
}

export async function runPnpm(args: string[] = [], options?: childProcess.SpawnOptions) {
  const executable = os.platform() === 'win32' ? 'pnpm.cmd' : 'pnpm';
  return await exec.spawn(path.join(getProjectPath(), executable), args, {
    cwd: getProjectPath(),
    shell: true,
    ...(options ?? {}),
  });
}
