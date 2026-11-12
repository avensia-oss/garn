import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export async function typecheck(tsConfigPath: string) {
  // Use the CLI supported by TypeScript 5 and newer to honor the complete
  // project configuration, including JSONC and extends.
  const compiler = fileURLToPath(new URL('./bin/tsc', import.meta.resolve('typescript/package.json')));
  return new Promise<{ hasErrors: boolean; errors: string[] }>((resolve, reject) => {
    execFile(
      process.execPath,
      [compiler, '--project', tsConfigPath, '--noEmit', '--pretty', 'false'],
      { maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error && (typeof error.code !== 'number' || error.killed)) {
          reject(error);
          return;
        }
        resolve({
          hasErrors: !!error,
          errors: (stdout + stderr).split(/\r?\n/).filter(Boolean),
        });
      },
    );
  });
}
