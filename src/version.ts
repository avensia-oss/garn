import * as cliArgs from './cli-args';
import * as git from './git';
import * as workspace from './workspace';
import * as log from './logging';

export type Version = {
  /** Three digit version, separated by dot. For example: 1.2.3 */
  version: string;
  sha1: string;
  /**
   * Either the full git tag name or undefined if the version not represented as a git tag.
   * Such a version is when a release is generated from the number of commits since the latest
   * tag.
   */
  gitTag?: string;
  packageName?: string;
  prerelease?: Prerelease;
};

export type Prerelease = {
  tag: string;
  number: number;
};

/**
 * Returns a string with format X.Y.Z(W) (semver 2.0 https://semver.org/spec/v2.0.0.html)
 * If the current commit has a pre-release, W will be the '-tagname.pre-release-number'.
 */
export function formatVersion(version: Version) {
  let versionString = version.version;
  if (version.prerelease) {
    versionString += `-${version.prerelease.tag}.${version.prerelease.number}`;
  }
  return versionString;
}

export async function currentVersion(): Promise<Version> {
  const cliVersionString = await cliArgs.flags.version.get();
  if (cliVersionString !== undefined) {
    const cliVersion = await fromTag(cliVersionString);
    const currentPackageName = workspace.current()?.name;
    if (cliVersion.packageName && cliVersion.packageName !== currentPackageName) {
      throw new Error(
        `The cli flag --version was set to '${cliVersionString}' but that does not match the current package which is '${
          currentPackageName ? currentPackageName : '(none)'
        }'`,
      );
    }
    // If the version is passed as `--version v1.0.0` it means that it applies to all workspace packages and we
    // inject the current package name. This allows you to do:
    // $ garn workspace publish --version=v1.0.0
    // to publish all packages as 1.0.0
    if (!cliVersion.packageName && currentPackageName) {
      cliVersion.packageName = currentPackageName;
    }
    return cliVersion;
  }

  if ((await cliArgs.flags.mode.get()) !== 'production') {
    return await unknownVersion();
  }

  const currentSha1 = await git.revParse('HEAD');
  const currentBranch = await git.branchName('HEAD');
  const latest = await latestVersion();
  if (latest.sha1 === currentSha1) {
    return latest;
  }

  const commitsSinceLatest = await git.commitCountBetween(latest.sha1, currentSha1);

  return {
    version: latest.version,
    packageName: latest.packageName,
    sha1: currentSha1,
    prerelease: {
      tag: latest.prerelease?.tag ?? currentBranch,
      number: Number(commitsSinceLatest) + (latest.prerelease?.number ?? 0),
    },
  };
}

export async function latestVersion(
  skipPrereleases = false,
  packageName?: string,
  outSkippedPrereleases?: Version[],
): Promise<Version> {
  let currentRef = 'HEAD';
  packageName = packageName ?? workspace.current()?.name;

  while (true) {
    // Note that we match both vX.Y.Z tags and package-name@X.Y.Z tags here. We simply want to find
    // the latest one of any of those two patterns.
    // This is useful when you typically release all packages at the same time with a vX.Y.Z tag
    // but sometimes tag a single package because you need to create a hotfix for that specific package.
    const matchArgs: string[] = [];
    matchArgs.push('--match', 'v[0-9]*');
    if (packageName) {
      matchArgs.push('--match', packageName + '@*');
    }

    let latestTag = '';
    try {
      latestTag = await git.describe(['--tags', ...matchArgs, '--abbrev=0', currentRef]);
    } catch (e) {
      log.verbose(e);
      return await unknownVersion(packageName);
    }

    const version = await fromTag(latestTag);
    if (version.prerelease && skipPrereleases) {
      if (outSkippedPrereleases) {
        outSkippedPrereleases.push(version);
      }
      currentRef = version.sha1 + '~1';
    } else {
      version.packageName = packageName;
      return version;
    }
  }
}

export function isVersionTag(s: string | null | undefined): s is string {
  if (!s) {
    return false;
  }
  return (
    /^[a-zA-Z0-9_-]+@[0-9]+\.[0-9]+\.[0-9]+(\-[a-zA-Z0-9\.]+)?$/.test(s) ||
    /^v[0-9]+\.[0-9]+\.[0-9]+(\-[a-zA-Z0-9\.]+)?$/.test(s)
  );
}

export async function fromTag(gitTag: string): Promise<Version> {
  if (!isVersionTag(gitTag)) {
    throw new Error(`The tag '${gitTag}' is not a valid version tag`);
  }
  const packageParts = gitTag.split('@');
  const packageName = packageParts.length === 2 ? packageParts[0] : undefined;
  const version = gitTag.match(/[0-9]+\.[0-9]+\.[0-9]+/)![0];

  const prereleaseParts = gitTag.split(/-([a-zA-Z]+)([0-9]+)$/);
  const prerelease: Prerelease | undefined =
    prereleaseParts.length === 4 ? { tag: prereleaseParts[1], number: Number(prereleaseParts[2]) } : undefined;

  let sha1 = '';
  try {
    sha1 = await git.revParse(gitTag);
  } catch (e) {
    log.verbose(`Error resolving sh1 for tag '${gitTag}', falling back to sha1 for HEAD...`);
    sha1 = await git.revParse('HEAD');
  }

  return {
    gitTag,
    sha1,
    version,
    packageName,
    prerelease,
  };
}

/** Tests that a string matches the pattern `X.Y.Z`, for example `1.2.3` or `10.31.997` */
export function isValid(versionNumbers: string) {
  return /^[0-9]+\.[0-9]+\.[0-9]+$/.test(versionNumbers);
}

export function parse(version: Version) {
  const parts = version.version.split('.').map(Number);
  if (version.prerelease) {
    parts.push(version.prerelease.number);
  }
  return parts;
}

export function formatGitTag(
  packageName: string | undefined,
  version: string,
  prereleaseNumber: number | undefined,
  prereleaseTag: string | undefined,
) {
  const prereleaseSuffix = prereleaseNumber ? formatPrerelease(prereleaseTag ?? 'unknown', prereleaseNumber) : '';
  if (packageName) {
    return `${packageName}@${version}${prereleaseSuffix}`;
  } else {
    return `v${version}${prereleaseSuffix}`;
  }
}

export function formatPrerelease(prereleaseTag: string, prereleaseNumber: number) {
  // maintain a consistent pre-release tag and package version for Semantic Versioning v2.0.0
  return `-${prereleaseTag ?? 'unknown'}.${prereleaseNumber}`;
}

export function highest(va: Version, vb: Version) {
  const vaParts = parse(va);
  const vbParts = parse(vb);
  if (vaParts[0] > vbParts[0]) {
    return va;
  }
  if (vaParts[0] < vbParts[0]) {
    return vb;
  }

  if (vaParts[1] > vbParts[1]) {
    return va;
  }
  if (vaParts[1] < vbParts[1]) {
    return vb;
  }

  if (vaParts[2] > vbParts[2]) {
    return va;
  }
  if (vaParts[2] < vbParts[2]) {
    return vb;
  }

  if (typeof vaParts[3] === 'number' && typeof vbParts[3] === 'number') {
    if (vaParts[3] > vbParts[3]) {
      return va;
    }
    if (vaParts[3] < vbParts[3]) {
      return vb;
    }
    if (vaParts[3] === vbParts[3]) {
      return 'same';
    }
  }

  if (typeof vaParts[3] === 'number' && typeof vbParts[3] === 'undefined') {
    // If va is 1.2.3 and vb is 1.2.3-rc0003 we consider va to be higher
    return vb;
  }
  if (typeof vaParts[3] === 'undefined' && typeof vbParts[3] === 'number') {
    return va;
  }

  return 'same';
}

async function unknownVersion(packageName?: string): Promise<Version> {
  return {
    version: '0.0.0',
    sha1: await git.revParse('HEAD'),
    packageName: packageName ?? workspace.current()?.name,
  };
}
