import { spawn, spawnSync } from './exec';
import { projectPath } from './index';
import * as log from './logging';
import { fromTag, isVersionTag, Version } from './version';

export type Tag = {
  name: string;
  version?: Version | null;
  createdAt: Date;
};

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

export async function getCurrentBranchName(cwd?: string) {
  return await revParseAbbr('HEAD', cwd);
}

export async function getDefaultBranchName(cwd?: string) {
  // Will have the format of origin/<default-branch-name> eg: origin/main
  const originDefault = await revParseAbbr('origin/HEAD', cwd);
  return originDefault.split('/')[1];
}

export async function getMergeBase(branch1: string, branch2: string, cwd?: string) {
  return await git(['merge-base', branch1, branch2], cwd);
}

export async function getTags(name: string = 'HEAD', cwd?: string) {
  const tags = await git(['tag', '--points-at', name], cwd);
  return tags.split('\n').map(s => s.trim());
}

export async function getDetailedTags(cwd?: string) {
  const deliminator = '!!!';
  const args = ['for-each-ref', '--sort=-creatordate', `--format=%(refname)${deliminator}%(creatordate)`, 'refs/tags'];

  const result = await git(args, cwd);

  const tags = result.split('\n');

  const parsedTags: Tag[] = await Promise.all(
    tags.map(async tagRaw => {
      const [tagWithRef, date] = tagRaw.split(deliminator);
      const tag = tagWithRef.replace('refs/tags/', '');
      return {
        name: tag,
        createdAt: new Date(date),
        version: isVersionTag(tag) ? await fromTag(tag, false) : null,
      };
    }),
  );

  return parsedTags;
}

export async function tagList(name: string, limit?: number, excludeRC: boolean = true, cwd?: string) {
  const tags = await tagListWithPattern(`${name}@*`, cwd);
  let result = tags;
  if (excludeRC) {
    result = tags.filter(s => !s.match(/(-rc\.)/));
  }

  return limit ? result.slice(0, limit) : result;
}

export async function tagListWithPattern(pattern: string, cwd?: string) {
  const args = ['tag', '-l', pattern, '--sort=-version:refname'];
  const tags = await git(args, cwd);

  return tags
    .split('\n')
    .map(t => t.trim())
    .filter(t => !!t); // Remove empty strings
}

export function tag(tag: string, message?: string, cwd?: string) {
  return message ? git(['tag', '-a', tag, '--cleanup=whitespace', '-m', message], cwd) : git(['tag', tag], cwd);
}

export async function tagExists(tag: string, cwd?: string) {
  try {
    await revParse(tag, cwd);
    return true;
  } catch (e) {
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

function gitSync(args: string[], cwd: string | undefined) {
  const result = spawnSync('git', args, { stdio: 'pipe', cwd: cwd ?? projectPath });
  return result.stdout.trim();
}

async function gitWithNetwork(args: string[], cwd: string | undefined) {
  await spawn('git', args, { stdio: 'inherit', cwd });
}

const separator = '?!!!!!?';
const newLineSeparator = '!?????!';
const logFormat = `%h${separator}%b${separator}%cs${separator}%an${separator}%ae${separator}%d${separator}%s${separator}%p${newLineSeparator}`;
const sha1Index = 0; //%h
const bodyIndex = 1; //%b body
const dateIndex = 2; //%cs short format (YYYY-MM-DD)
const authorNameIndex = 3; //%an';
const authorEmailIndex = 4; //%ae';
const referencesIndex = 5; //%d tags etc';
const subjectIndex = 6; //%s';
const sha1RangeIndex = 7; //%p abbreviated parent hashes
const commit_regex = '^((fixup!)|(feat|fix|refactor|style|chore|docs|test|revert))';
const typeRegex = new RegExp(commit_regex);

export type LogOptions = {
  since?: string;
  until?: string;
  from?: string;
  to?: string;
  path?: string;
  onlyMerges?: boolean;
};

export type Commit = {
  sha1: string;
  author: string;
  email: string;
  date: string;
  type: string;
  subject: string;
  body: string;
  references: string;
  isMerge: boolean;
  merge?: {
    pullNumber: string;
    baseSha1: string;
    toSha1: string;
    commits: Commit[];
  };
};

export async function logBetween(
  options: LogOptions = {
    to: 'HEAD',
    path: '',
    onlyMerges: false,
  },
  cwd?: string,
) {
  let args = ['log', '--topo-order', `--pretty=format:${logFormat}`];

  if (options.onlyMerges) {
    args.push('--merges');
  }

  if (options?.to && options.to !== '') {
    args.push(options.to + '...' + options.from);
  }

  if (options?.since && options.since !== '') {
    args.push(`--since=${options.since}`);
  }

  if (options?.until && options.until !== '') {
    args.push(`--until=${options.until}`);
  }

  if (options?.path && options.path != '') {
    args.push(options.path);
  }

  const rawCommitOutput = await gitSync(args, cwd);

  const rawCommits = rawCommitOutput
    .replace(/\r?\n/g, '') // Removes new line
    .split(newLineSeparator)
    .map(s => s.trim());

  if (!rawCommits || rawCommits.length === 0) {
    return [];
  }

  let commits: Commit[] = [];
  rawCommits.forEach(commit => {
    if (commit && commit !== '') {
      commits.push(parseRawCommitMessage(commit));
    }
  });

  return commits;
}

function parseRawCommitMessage(rawCommit: string): Commit {
  const values = rawCommit.split(separator);
  const isMerge = (values[subjectIndex]?.startsWith('Merge') && values[subjectIndex]?.includes('#')) ?? false;
  const commitType = !isMerge ? typeRegex.exec(values[subjectIndex]) ?? [''] : ['merge'];
  const commit: Commit = {
    sha1: values[sha1Index],
    body: values[bodyIndex] ?? '',
    date: values[dateIndex],
    author: values[authorNameIndex] ?? '',
    email: values[authorEmailIndex] ?? '',
    references: values[referencesIndex] ?? '',
    type: commitType[0],
    isMerge,
    subject: isMerge ? 'Merge' : values[subjectIndex] ?? '',
  };

  if (isMerge) {
    var mergeMessage = values[subjectIndex].split(' ');
    var commitRange = values[sha1RangeIndex].slice(0, values[sha1RangeIndex].length - 1).split(' '); // remove quote
    commit.merge = {
      pullNumber: mergeMessage[3].slice(1), // remove #
      baseSha1: commitRange[0],
      toSha1: commitRange[1],
      commits: [],
    };
  }

  return commit;
}
