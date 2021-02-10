import { spawn } from './exec';
import { projectPath } from './index';
import * as log from './logging';

export async function revParse(name: string, cwd?: string) {
  return git(['rev-parse', name], cwd);
}

export async function commitCountBetween(from: string, to: string, cwd?: string) {
  return git(['rev-list', '--count', '^' + from, to], cwd);
}

export async function revParseAbbr(name: string, cwd?: string) {
  let ref = await git(['rev-parse', '--abbrev-ref', name], cwd);
  if (ref === '') {
    ref = await revParse(name, cwd);
  }
  return ref;
}

export function describe(args: string[] = [], cwd?: string) {
  return git(['describe'].concat(args), cwd);
}

export function status(args: string[] = [], cwd?: string) {
  return git(['status'].concat(args), cwd);
}

export function checkout(name: string, cwd?: string) {
  return git(['checkout', name], cwd);
}

export function branch(args: string[] = [], cwd?: string) {
  return git(['branch'].concat(args), cwd);
}

export async function getTags(name: string = 'HEAD', cwd?: string) {
  const tags = await git(['tag', '--points-at', name], cwd);
  return tags.split('\n').map(s => s.trim());
}

export function tag(tag: string, message?: string, cwd?: string) {
  return message ? git(['tag', '-a', tag, '--cleanup=whitespace', '-m', message], cwd) : git(['tag', tag], cwd);
}

export async function tagExists(tag: string, cwd?: string) {
  try {
    await revParse(tag, cwd)
    return true;
  } catch(e) {
    return false;
  }
}

export function deleteTag(tag: string, cwd?: string) {
  return git(['tag', '-d', tag], cwd);
}

export function merge(name: string, commitMessage: string, fastForward = false, cwd?: string) {
  let args = ['merge'];
  if (!fastForward) {
    args.push('--no-ff');
  }
  args = args.concat([name, '-m', commitMessage]);
  return git(args, cwd);
}

export async function branchName(name: string, cwd?: string) {
  const refName = await revParseAbbr(name, cwd);
  if (refName === name) {
    const remoteBranches = (await git(['branch', '-r', '--contains', name], cwd)).split('\n').map(s =>
      s
        // Replaces `origin/HEAD -> origin/master` with `origin/master`
        .replace(/^.*? -> /, '')
        // Replaces `origin/master` with `master`
        .replace(/^.*?\//, '')
        .trim(),
    );

    if (remoteBranches.length) {
      if (remoteBranches.length > 1) {
        log.log(
          'Found several branches for current commit: ' + remoteBranches.join(', ') + ', selecting the first one',
        );
      }
      return remoteBranches[0];
    }

    return 'unknown';
  }
  return refName;
}

export function push(names: string | string[], cwd?: string) {
  if (typeof names === 'string') {
    names = [names];
  }
  return gitWithNetwork(['push', 'origin'].concat(names), cwd);
}

export function fetch(cwd?: string) {
  return gitWithNetwork(['fetch', '--tags', '--quiet'], cwd);
}

export function pull(withRebase = true, cwd?: string) {
  const args = ['pull'];
  if (withRebase) {
    args.push('--rebase');
  }
  return gitWithNetwork(args, cwd);
}

async function git(args: string[], cwd: string | undefined) {
  const result = await spawn('git', args, { stdio: 'pipe', cwd: cwd ?? projectPath });
  return result.stdout.trim();
}

async function gitWithNetwork(args: string[], cwd: string | undefined) {
  await spawn('git', args, { stdio: 'inherit', cwd });
}
