import * as os from 'os';
import * as childProcess from 'child_process';
import * as path from 'path';
import { projectPath } from './index';
import * as exec from './exec';

export async function runScript(script: string, args: string[] = []) {
  return runPnpm(['run', script, ...args]);
}

export async function runExec(script: string, args: string[] = []) {
  return runPnpm(['exec', script, ...args]);
}

export async function runPnpm(args: string[] = [], options?: childProcess.SpawnOptions) {
  const executable = os.platform() === 'win32' ? 'pnpm.cmd' : 'pnpm';
  return await exec.spawn(path.join(projectPath, executable), args, {
    cwd: projectPath,
    ...(options ?? {}),
  });
}
