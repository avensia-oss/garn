import * as childProcess from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as log from './logging';
import * as variables from './variables';
import * as prompt from './prompt';

export function spawnSync(
  command: string,
  args: string[],
  options?: childProcess.SpawnOptions,
): { stdout: string; stderr: string } {
  if (command.indexOf('/') === -1 && command.indexOf('\\') === -1) {
    if (!isInPath(command)) {
      throw new Error(
        `The executable '${command}' could not be found in your PATH. You should add it to the PATH or reinstall the program.`,
      );
    }
  }

  const processResult = childProcess.spawnSync(command, args, options);

  return {
    stdout: processResult.stdout.toString('utf8'),
    stderr: processResult.stderr.toString('utf8'),
  };
}

export async function spawn(
  command: string,
  args: string[],
  options?: childProcess.SpawnOptions,
): Promise<{ stdout: string; stderr: string }> {
  if (command.indexOf('/') === -1 && command.indexOf('\\') === -1) {
    if (!isInPath(command)) {
      throw new Error(
        `The executable '${command}' could not be found in your PATH. You should add it to the PATH or reinstall the program.`,
      );
    }
  }

  return new Promise((resolve, reject) => {
    options = options || {};
    if (!options.stdio) {
      options.stdio = [process.stdin, process.stdout, process.stderr];
    }
    let programName = command;
    if (path.isAbsolute(command)) {
      programName = path.basename(programName);
    }

    log.verbose(`Spawning '${command}' with args '${args.join(' ')}'`);
    const spawnedProcess = childProcess.spawn(command, args, options);
    const outChunks: any[] = [];
    const outListener = (chunk: any) => outChunks.push(chunk);
    if (spawnedProcess.stdout) {
      spawnedProcess.stdout.on('data', outListener);
    } else {
      outChunks.push(
        Buffer.from(
          `Are you trying to capture the output of a spawned process? Then you should pass {stdio: 'pipe'} as options to spawn()`,
        ),
      );
    }

    const errChunks: any[] = [];
    const errListener = (chunk: any) => errChunks.push(chunk);
    if (spawnedProcess.stderr) {
      spawnedProcess.stderr.on('data', errListener);
    }

    spawnedProcess.on('error', err => {
      log.error(err);
      spawnedProcess.stderr?.removeListener('data', errListener);
      spawnedProcess.stdout?.removeListener('data', outListener);
      reject(`${programName} ${args.join(' ')} failed`);
    });
    spawnedProcess.on('exit', (code: number) => {
      spawnedProcess.stderr?.removeListener('data', errListener);
      spawnedProcess.stdout?.removeListener('data', outListener);

      if (code && code !== 3221225786) {
        const stderr = Buffer.concat(errChunks).toString('utf8');
        reject(`${programName} ${args.join(' ')} failed with code ${code}. ${stderr ? 'Output:' + stderr : ''}`);
      } else {
        resolve({
          stdout: Buffer.concat(outChunks).toString('utf8'),
          stderr: Buffer.concat(errChunks).toString('utf8'),
        });
      }
    });
  });
}

const commandsFoundInPath: string[] = [];

export function isInPath(command: string) {
  if (commandsFoundInPath.indexOf(command) !== -1) {
    return true;
  }

  try {
    if (os.platform() === 'win32') {
      const res = childProcess.spawnSync('where', [command]);

      if (res.status !== 0) {
        return false;
      }
    } else {
      const res = childProcess.spawnSync('whereis', [command]);

      if (res.status !== 0) {
        return false;
      }
    }

    commandsFoundInPath.push(command);

    return true;
  } catch (e) {
    log.verbose(`Error when trying to find ${command} in the PATH`, e);

    return false;
  }
}

export async function executablePath(executableName: string, variableName: string) {
  if (process.env[variableName]) {
    return process.env[variableName]!;
  }

  let executablePath = '';

  if (!isInPath(executableName)) {
    while (true) {
      executablePath = await prompt.question(`Enter the path to your '${executableName}' executable`);

      if (!fs.existsSync(executablePath)) {
        log.log(`No file called '${executablePath}' exists, please try again`);
      } else {
        break;
      }
    }

    variables.saveEnvVariable(variableName, executablePath);
  } else {
    variables.saveEnvVariable(variableName, executableName);
    executablePath = executableName;
  }

  return executablePath;
}
