import os from 'os';
import childProcess from 'child_process';
import path from 'path';
import { getProjectPath } from './index.mts';
import { spawn } from './exec.mjs';

export async function runNode(args: string[] = [], options?: childProcess.SpawnOptions) {
  const executable = os.platform() === 'win32' ? 'node.cmd' : 'node';
  return await spawn(path.join(getProjectPath(), executable), args, {
    cwd: getProjectPath(),
    shell: true,
    ...(options ?? {}),
  });
}
