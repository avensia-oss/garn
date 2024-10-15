import * as os from 'os';
import * as childProcess from 'child_process';
import * as path from 'path';
import { projectPath } from './index';
import * as exec from './exec';

export async function runNode(args: string[] = [], options?: childProcess.SpawnOptions) {
  const executable = os.platform() === 'win32' ? 'node.cmd' : 'node';
  return await exec.spawn(path.join(projectPath, executable), args, {
    cwd: projectPath,
    shell: true,
    ...(options ?? {}),
  });
}
