/**
 * # Different types of releases
 * We support tagging of 3 different types of tags
 * * release
 * * release-candidate
 * * base-prerelease
 *
 * ## release
 * Tagging the next release will find the next unused major/minor/patch stable version x.y.z
 * and create package-name@x.y.z tag
 *
 * ## release-candidate
 * Tagging the next release-candidate will find the next available major/minor/patch version x.y.z
 * and create package-name@x.y.z-prereleaseName.iteration tag
 *
 * ## base-prerelease
 * Tagging the next base-prerelease will find the latest stable a.b.c
 * and create package-name@a.b.c-prereleaseName.iteration tag
 *
 * # Examples:
 *
 * ## pre conditions
 * the following tags exist (from newest to oldest):
 * * esales@0.2.3-testing.1
 * * esales@0.2.4-rc.1
 * * esales@0.2.3
 * * esales@0.2.3-rc.2
 * * esales@0.2.3-rc.1
 *
 * ## Create a new release-candidate for esales package with patch bump and default prereleaseName
 * ### post conditions
 * esales@0.2.4-rc.2 exists
 *
 * ## Create a new release-candidate for esales package with minor bump and default prereleaseName
 * ### post conditions
 * esales@0.3.0-rc.1 exists
 *
 * ## Create a new release for esales package with minor bump
 * ### post conditions
 * esales@0.2.4 exists
 *
 * ## Create a new base-prerelease for esales package with prereleaseName testing
 * ### post conditions
 * esales@0.2.3-testing.2 exists
 *
 * ## Create a new base-prerelease for esales package with prereleaseName testingSomethingElse
 * ### post conditions
 * esales@0.2.3-testingSomethingElse.1 exists
 */

import * as chalk from 'chalk';
import * as git from './git';
import * as log from './logging';
import * as prompt from './prompt';
import * as version from './version';
import * as workspace from './workspace';

const defaultReleaseBranch = 'master';
const defaultPrereleaseTag = 'rc';

prompt.selectOption;

export enum ReleaseType {
  Release,
  ReleaseCandidate,
  BasePrerelease,
}

export async function tagBasePrerelease(prereleaseTag = defaultPrereleaseTag, releaseBranch = defaultReleaseBranch) {
  return await createReleaseTag(ReleaseType.BasePrerelease, releaseBranch, prereleaseTag, undefined);
}

export async function tagRelease(releaseBranch = defaultReleaseBranch) {
  return await createReleaseTag(ReleaseType.Release, releaseBranch, defaultPrereleaseTag, undefined);
}

export async function tagPrerelease(prereleaseTag = defaultPrereleaseTag, releaseBranch = defaultReleaseBranch) {
  return await createReleaseTag(ReleaseType.ReleaseCandidate, releaseBranch, prereleaseTag, undefined);
}

export async function tagPackagesBasePrerelease(
  packages: string[],
  prereleaseTag = defaultPrereleaseTag,
  releaseBranch = defaultReleaseBranch,
) {
  return await createReleaseTag(ReleaseType.BasePrerelease, releaseBranch, prereleaseTag, packages);
}

export async function tagPackagesPrerelease(
  packages: string[],
  prereleaseTag = defaultPrereleaseTag,
  releaseBranch = defaultReleaseBranch,
) {
  return await createReleaseTag(ReleaseType.ReleaseCandidate, releaseBranch, prereleaseTag, packages);
}

export async function tagPackagesRelease(packages: string[], releaseBranch = defaultReleaseBranch) {
  return await createReleaseTag(ReleaseType.Release, releaseBranch, defaultPrereleaseTag, packages);
}

async function createReleaseTag(
  releaseType: ReleaseType,
  releaseBranch: string,
  prereleaseTag: string,
  packages: string[] | undefined,
) {
  let packagesToTag: (string | undefined)[] = [];
  const currentPackage = workspace.current()?.name;
  if (packages !== undefined && currentPackage !== undefined) {
    log.error(
      `It's not possible to tag a release for other packages inside a package, only the root buildsystem can specify packages to tag. Current package is '${currentPackage}', attempted packages: '${packages.join(
        `', '`,
      )}'`,
    );
    return false;
  } else if (currentPackage && !packages) {
    packagesToTag = [currentPackage];
  } else if (packages) {
    packagesToTag = packages;
  } else {
    packagesToTag = [undefined];
  }

  if (packages) {
    const packagesToInclude = await prompt.selectOptions(
      `You are about tag a ${releaseType}. Which packages do you want to include?`,
      packages.map(p => ({
        name: p,
        value: p,
        checked: true,
      })),
    );
    packagesToTag = packagesToInclude;
    log.log('');
    log.log('Packages selected for release:');
    for (const pkg of packagesToTag) {
      log.log(' - ', chalk.green(pkg));
    }
    log.log('');
  }

  if (packagesToTag.length === 0) {
    log.log('Okay, maybe some other time then');
    return false;
  }

  if ((await git.status(['--porcelain'])) !== '') {
    if (!(await prompt.answersYes('Your working directory is not clean, do you still want to continue?'))) {
      log.log('Okay, aborting');
      return false;
    }
  }

  log.log('Fetching latest from remote...');
  await git.fetch();
  log.log('');

  const currentBranch = await git.revParseAbbr('HEAD');
  if ((await git.branch(['-r', '--contains', await git.revParse(currentBranch)])) === '') {
    log.log(`Your commits are not in sync with remote.`);
    log.log('Please pull/push to get them in sync first.');
    log.log('');
    return false;
  }

  const isOnReleaseBranch = releaseBranch === (await git.revParseAbbr('HEAD'));

  if (!isOnReleaseBranch) {
    if (
      releaseType === ReleaseType.Release &&
      !(await prompt.answersYes(
        `It seems that you are not on ${releaseBranch}, do you still want to tag the current commit?`,
      ))
    ) {
      log.log('Okay, aborting');
      return false;
    } else {
      log.log('');
    }
  }

  if (isOnReleaseBranch && releaseType !== ReleaseType.Release) {
    if (
      !(await prompt.answersYes(
        `It seems that you are on ${releaseBranch}. Prereleases are typically made from a different branch than ${releaseBranch}, are you sure you want to continue?`,
      ))
    ) {
      log.log('Okay, aborting');
      return false;
    } else {
      log.log('');
    }
  }

  const gitTags: string[] = [];
  for (const packageName of packagesToTag) {
    const skippedPrereleases: version.Version[] = [];
    let latestVersion: version.Version | undefined = undefined;
    const packageVersion = await version.latestVersion(true, packageName, skippedPrereleases);

    if (!latestVersion || version.highest(packageVersion, latestVersion) === packageVersion) {
      latestVersion = packageVersion;
    }

    if (!latestVersion) {
      throw new Error('Internal garn error, unable to find the latest version');
    }

    let newVersion: string;
    let prereleaseNumber: number | undefined;
    if (releaseType === ReleaseType.Release) {
      const enteredVersion = await promptForNewVersion(latestVersion, ReleaseType.Release, skippedPrereleases);
      if (enteredVersion === undefined) {
        return false;
      } else {
        newVersion = enteredVersion;
      }
      log.log('');
    } else {
      const previousPrerelease = skippedPrereleases.find(
        sp => sp.version === latestVersion?.version && sp.prerelease?.tag === prereleaseTag,
      );
      if (previousPrerelease !== undefined) {
        newVersion = latestVersion.version;
        prereleaseNumber = (previousPrerelease.prerelease?.number ?? 0) + 1;
        log.log(
          `Latest version was also a prerelease (${previousPrerelease.gitTag}), increasing the prerelease number from that to ${prereleaseNumber}.`,
        );
        log.log('');
      } else {
        const enteredVersion = await promptForNewVersion(latestVersion, releaseType, skippedPrereleases);
        if (enteredVersion === undefined) {
          return false;
        } else {
          newVersion = enteredVersion;
        }
        prereleaseNumber = 1;
        log.log('');
      }
    }

    let gitTag = version.formatGitTag(packageName, newVersion, prereleaseNumber, prereleaseTag);
    while (await git.tagExists(gitTag)) {
      log.log(
        `The tag ${gitTag} already exists but on a different line than you're on. It was most likely created in a different branch.`,
      );
      const manualVersion = await prompt.question('Enter a version of your choosing (format: x.y.z)', {
        pattern: /[0-9]+\.[0-9]+\.[0-9]+/,
      });
      gitTag = version.formatGitTag(packageName, manualVersion, prereleaseNumber, prereleaseTag);
    }

    await git.tag(gitTag);
    gitTags.push(gitTag);
  }
  if (
    !(await prompt.answersYes(`The current commit has been tagged with ${gitTags.join(', ')}. Do you want to push?`))
  ) {
    log.log('Okay, aborting');
    for (const gitTag of gitTags) {
      await git.deleteTag(gitTag);
    }
    return false;
  } else {
    log.log(`Pushing ${gitTags.join(', ')}...`);
    await git.push(gitTags.map(t => 'refs/tags/' + t));
  }

  if (!isOnReleaseBranch && releaseType === ReleaseType.Release) {
    if (
      await prompt.answersYes(
        `Since you're not on ${releaseBranch}, do you want to merge and push this to ${releaseBranch} now?`,
      )
    ) {
      log.log(`Checking out ${releaseBranch} and merging...`);
      await git.checkout(releaseBranch);
      await git.pull();
      await git.merge(gitTags[0], 'Hotfix release');
      await git.push(releaseBranch);
      await git.checkout(currentBranch);
    } else {
      log.log(
        `Skipping merge with ${releaseBranch}, please make sure that the code on this branch is somehow integrated to ${releaseBranch} eventually.`,
      );
    }
  }
}

async function promptForNewVersion(
  latestVersion: version.Version,
  releaseType: ReleaseType,
  skippedPrereleases: version.Version[],
) {
  let currentVersion = latestVersion.gitTag ? ` The latest version is: ${latestVersion.version}.` : '';
  let packageText = '';
  if (latestVersion.packageName) {
    packageText = ` for '${latestVersion.packageName}'`;
    log.log('');
    log.log('');
    log.log(chalk.underline(chalk.greenBright(`Package: '${latestVersion.packageName}'`)));
  }
  if (releaseType === ReleaseType.Release) {
    if (skippedPrereleases.length) {
      const higherPrereleaseVersion = skippedPrereleases.find(s => s > latestVersion);
      if (higherPrereleaseVersion) {
        currentVersion += ` There is also a prerelease for ${higherPrereleaseVersion}.`;
      }
    }
    log.log(`Time to pick a new version number${packageText}.${currentVersion}`);
    log.log('');
    log.log(`Do you want to create:`);
    log.log('');
  } else if (releaseType === ReleaseType.ReleaseCandidate) {
    log.log(`Time to pick a new version number for the upcoming new release${packageText}.${currentVersion}`);
    log.log('');
    log.log(`Do you want to create a release candidate for:`);
    log.log('');
  } else {
    log.log(`Time to pick a new version number for the upcoming new release${packageText}.${currentVersion}`);
    log.log('');
    log.log(`Do you want to create a base prerelease for:`);
    log.log('');
  }
  let option;
  if (releaseType === ReleaseType.Release || releaseType === ReleaseType.ReleaseCandidate) {
    option = await prompt.selectOption('Do you want to create', [
      {
        name: 'A new major version? A major version can contain breaking changes',
        value: 'major',
      },
      {
        name: 'A new minor version? A minor version contains new features and fixes but no breaking changes',
        value: 'minor',
      },
      {
        name: 'A new patch version? A patch version only contains bug fixes',
        value: 'patch',
      },
      {
        name: 'I want to set my own version number thank you very much',
        value: 'custom',
      },
    ]);
  } else {
    option = await prompt.selectOption('Do you want to create', [
      {
        name: `${latestVersion.version}`,
        value: 'latest',
      },
      {
        name: 'I want to set my own version number thank you very much',
        value: 'custom',
      },
    ]);
  }

  while (true) {
    const parts = version.parse(latestVersion);
    let newVersion = '';
    if (option === 'major') {
      newVersion = `${parts[0] + 1}.0.0`;
    } else if (option === 'minor') {
      newVersion = `${parts[0]}.${parts[1] + 1}.0`;
    } else if (option === 'patch') {
      newVersion = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    } else if (option === 'latest') {
      newVersion = `${parts[0]}.${parts[1]}.${parts[2]}`;
    } else if (option === 'custom') {
      while (!version.isValid(newVersion)) {
        newVersion = await prompt.question('Enter a version of your choosing (format: x.y.z)', {
          pattern: /[0-9]+\.[0-9]+\.[0-9]+/,
        });
        const compareVersion = {
          version: newVersion,
          sha1: '',
        };
        if (!version.isValid(newVersion)) {
          log.log(`That's not a valid version though...`);
        } else if (version.highest(latestVersion, compareVersion) !== compareVersion) {
          log.log(`It has to be higher than the latest (${latestVersion.version})`);
        }
      }
    }
    if (newVersion) {
      let packageText = '';
      if (latestVersion.packageName) {
        packageText = ' for package ' + chalk.green(latestVersion.packageName);
      }
      log.log('Selected version ' + chalk.magentaBright(newVersion) + packageText);
      return newVersion;
    }
  }
}
