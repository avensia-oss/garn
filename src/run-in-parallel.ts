import * as path from 'path';
import { spawn, StdioOptions } from 'child_process';
import * as through from 'through';
import * as stream from 'stream';

import * as log from './logging';
import * as cliArgs from './cli-args';

export type ParallelProgram = {
  program: string;
  args: string[];
  prefix?: string;
  cwd?: string;
};

export async function runInParallel(programs: ParallelProgram[], maxParallelism = Infinity, shouldProxy = false) {
  const batches: Array<Array<ParallelProgram>> = [];
  let i = 0;
  let currentBatch: ParallelProgram[] = [];
  for (const program of programs) {
    currentBatch.push(program);
    i++;

    if (i == maxParallelism) {
      batches.push(currentBatch);
      currentBatch = [];
      i = 0;
    }
  }

  let results: unknown[] = [];
  for (const batch of batches) {
    results.push(await executePrograms(batch, shouldProxy));
  }
  return maxParallelism === Infinity ? results[0] : results;
}

function executePrograms(programs: ParallelProgram[], shouldProxy: boolean) {
  let anyStreamIsOutputting = false;
  let unpauseStreams: Array<() => void> = [];
  return Promise.all(
    programs.map(program => {
      return new Promise<void>(async (resolve, reject) => {
        let thisStreamIsOutputting = false;
        const stdio: StdioOptions = [process.stdin, 'pipe', 'pipe'];
        const args = program.args;

        for (const [name, value] of await cliArgs.getChildArgs()) {
          if (args.indexOf(name) === -1) {
            args.push(name);
            if (value !== undefined) {
              args.push(value);
            }
          }
        }

        if (shouldProxy) {
          Object.keys(cliArgs.argv)
            .filter(key => {
              if (key !== '_' && key !== '--' && key !== 'buildsystem-path' && key !== 'proxyArgs') return true;
            })
            .forEach(flag => {
              const flagName = `--${flag}`;
              const value = cliArgs.argv[flag];

              if (args.indexOf(flagName) === -1) {
                let val = value === true ? undefined : value;

                if (/^--no-.+/.test(flagName) && val === false) {
                  val = undefined;
                }

                args.push(...[flagName, val]);
              }
            });
        }

        log.verbose(`Spawning '${program.program}${args.length === 0 ? '' : ' '}${args.join(' ')}'`);
        const command = spawn(program.program, args, { stdio, ...(program.cwd ? { cwd: program.cwd } : {}) });

        const outThrough = through(
          function (this: any, data) {
            this.queue((program.prefix || '') + data);
          },
          function (this: any) {
            this.queue(null);
          },
        );

        const errThrough = through(
          function (this: any, data) {
            this.queue((program.prefix || '') + data);
          },
          function (this: any) {
            this.queue(null);
          },
        );

        const outStream = new stream.Writable();
        (outStream as any)._write = (chunk: any, enc: any, next: () => void) => {
          outThrough.write(chunk);
          next();
        };
        const errStream = new stream.Writable();
        (errStream as any)._write = (chunk: any, enc: any, next: () => void) => {
          errThrough.write(chunk);
          next();
        };

        if (anyStreamIsOutputting) {
          outThrough.pause();
          errThrough.pause();
          unpauseStreams.push(() => {
            outThrough.resume();
            errThrough.resume();
            thisStreamIsOutputting = true;
          });
        } else {
          anyStreamIsOutputting = true;
          thisStreamIsOutputting = true;
        }

        command.stdout!.pipe(outStream);
        command.stderr!.pipe(errStream);

        outThrough.pipe(process.stdout);
        errThrough.pipe(process.stderr);

        command.on('exit', (code: number) => {
          if (code) {
            let programName = program.program;
            if (path.isAbsolute(programName)) {
              programName = path.basename(programName);
            }

            reject(`${programName} ${program.args.join(' ')} failed`);
          } else {
            resolve();
          }

          if (thisStreamIsOutputting) {
            const unpauseNext = unpauseStreams.shift();
            if (unpauseNext) {
              unpauseNext();
            }
          }
        });
      });
    }),
  ).then(
    () => {
      unpauseStreams.forEach(unpause => unpause());
      unpauseStreams = [];
    },
    e => {
      unpauseStreams.forEach(unpause => unpause());
      unpauseStreams = [];
      return Promise.reject(e);
    },
  );
}
