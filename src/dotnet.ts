import * as path from 'path';
import { projectPath } from './index';
import { spawn } from './exec';
import { flags } from './cli-args';
import { currentVersion, formatVersion } from './version';

export type DotNetOptions = {
  cwd?: string;
  noBuild?: boolean;
  noRestore?: boolean;
};

export type DotNetLaunchOptions = DotNetOptions & {
  launchProfile: string;
};

export async function listProjects(sln?: string) {
  const slnPath = sln ?? (await solutionPath());
  if (!slnPath) {
    throw new Error('Unable to find a .sln file');
  }
  const result = await spawn('dotnet', ['sln', slnPath, 'list'], { stdio: 'pipe' });
  const lines = result.stdout
    .trim()
    .split('\n')
    .map(s => s.trim());

  const projects: string[] = [];
  let projectsStarted = false;
  for (const line of lines) {
    if (line.startsWith('-----')) {
      projectsStarted = true;
    } else if (projectsStarted) {
      projects.push(path.join(path.dirname(slnPath), line));
    }
  }
  return projects;
}

export async function run(project: string, appArgs: string[], options: DotNetLaunchOptions) {
  const args = ['run'];
  args.push('--project', project);
  args.push('--launch-profile', options.launchProfile);
  return await spawnDotnet(args, appArgs, options);
}

export async function clean(entry?: string, options?: DotNetOptions) {
  return await spawnDotnet(withEntry(entry, ['clean']), [], options);
}

export async function test(entry?: string, options?: DotNetOptions) {
  return await spawnDotnet(withEntry(entry, ['test']), [], options);
}

export async function restore(entry?: string, options?: DotNetOptions) {
  const args = ['restore'];
  if (entry) {
    args.push(entry);
  }
  // Restore doesn't take the same base args as others
  return await spawn('dotnet', args, spawnOptions(options?.cwd));
}

export async function watchRun(project: string, appArgs: string[], options: DotNetLaunchOptions) {
  const args = ['watch', 'run'];
  args.push('--project', project);
  if (!options.cwd) {
    options.cwd = path.dirname(project);
  }
  args.push('--launch-profile', options.launchProfile);
  args.push('--no-restore');
  return await spawnDotnet(args, appArgs, options);
}

export async function build(entry?: string, options?: DotNetOptions) {
  const args = ['build'];
  if (entry) {
    args.push(entry);
  }
  return await spawnDotnet(args, [], options);
}

export async function publish(entry: string, options: DotNetOptions & { outputPath: string; runtime?: string }) {
  const args = ['publish', entry, '--output', options.outputPath];
  if (options.runtime) {
    args.push('--runtime', options.runtime);
  }
  return await spawnDotnet(args, [], options);
}

export async function solutionPath() {
  const glob = await import('glob');
  const result = glob.sync('*.sln', { cwd: projectPath });
  if (!result[0]) {
    return undefined;
  }
  return path.join(projectPath, result[0]);
}

function withEntry(entry: string | undefined, args: string[]) {
  if (!entry) {
    return args;
  }
  return [entry, ...args];
}

async function spawnDotnet(args: string[], appArgs: string[] = [], options?: DotNetOptions) {
  const dotnetArgs = [...args];
  if (options?.noBuild) {
    dotnetArgs.push('--no-build');
  }
  if (options?.noRestore) {
    dotnetArgs.push('--no-restore');
  }
  dotnetArgs.push(...(await baseArgs()));
  if (appArgs.length) {
    dotnetArgs.push('--', ...appArgs);
  }
  return await spawn('dotnet', dotnetArgs, spawnOptions(options?.cwd));
}

async function baseArgs() {
  const args = [...(await verbosityArg()), ...(await configurationArg()), ...(await versionArg())];
  return args;
}

function spawnOptions(cwd?: string) {
  if (cwd) {
    return { cwd };
  }
  return undefined;
}

async function verbosityArg() {
  const v = (async () => {
    switch (await flags.logLevel.get()) {
      case 'verbose':
        return 'normal';
      case 'info':
        return 'normal';
      case 'log':
        return 'minimal';
      case 'warn':
        return 'minimal';
      case 'error':
        return 'quiet';
    }
  })();
  return ['--verbosity', await v];
}

async function configurationArg() {
  return ['--configuration', (await flags.mode.get()) === 'production' ? 'Release' : 'Debug'];
}

async function versionArg() {
  const args = [];
  if ((await flags.mode.get()) === 'production') {
    const version = await currentVersion();
    const major = version.version.split('.')[0];
    let versionString = version.version;
    if (version.prerelease) {
      versionString += '.' + version.prerelease.number;
    } else {
      versionString += '.0'; // Important for the version to always have the format X.X.X.X
    }
    args.push(`-p:Version=${versionString}`);
    args.push(`-p:SourceRevisionId=${version.sha1}`);
  }
  return args;
}
