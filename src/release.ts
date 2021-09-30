import * as chalk from 'chalk';
import * as log from './logging';
import * as version from './version';
import * as prompt from './prompt';
import * as git from './git';
import * as workspace from './workspace';

const defaultReleaseBranch = 'master';
const defaultPrereleaseTag = 'rc';

prompt.selectOption;

export async function tagRelease(releaseBranch = defaultReleaseBranch) {
  return await createReleaseTag(false, releaseBranch, defaultPrereleaseTag, undefined);
}

export async function tagPrerelease(prereleaseTag = defaultPrereleaseTag, releaseBranch = defaultReleaseBranch) {
  return await createReleaseTag(true, releaseBranch, prereleaseTag, undefined);
}

export async function tagPackagesPrerelease(
  packages: string[],
  prereleaseTag = defaultPrereleaseTag,
  releaseBranch = defaultReleaseBranch,
) {
  return await createReleaseTag(true, releaseBranch, prereleaseTag, packages);
}

export async function tagPackagesRelease(packages: string[], releaseBranch = defaultReleaseBranch) {
  return await createReleaseTag(false, releaseBranch, defaultPrereleaseTag, packages);
}

async function createReleaseTag(
  isPrerelease: boolean,
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
      `You are about tag a ${isPrerelease ? 'prerelease' : 'release'}. Which packages do you want to include?`,
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
      !isPrerelease &&
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

  if (isOnReleaseBranch && isPrerelease) {
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
    const packageVersion = await version.latestVersion(!isPrerelease, packageName, skippedPrereleases);

    if (!latestVersion || version.highest(packageVersion, latestVersion) === packageVersion) {
      latestVersion = packageVersion;
    }

    if (!latestVersion) {
      throw new Error('Internal garn error, unable to find the latest version');
    }

    let newVersion: string;
    let prereleaseNumber: number | undefined;
    if (!isPrerelease) {
      const enteredVersion = await promptForNewVersion(latestVersion, isPrerelease, skippedPrereleases);
      if (enteredVersion === undefined) {
        return false;
      } else {
        newVersion = enteredVersion;
      }
      log.log('');
    } else {
      if (latestVersion.prerelease) {
        newVersion = latestVersion.version;
        prereleaseNumber = latestVersion.prerelease.number + 1;
        log.log(
          `Latest version was also a prerelease (${latestVersion.gitTag}), increasing the prerelease number from that.`,
        );
        log.log('');
      } else {
        const enteredVersion = await promptForNewVersion(latestVersion, isPrerelease, skippedPrereleases);
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

  if (!isOnReleaseBranch && !isPrerelease) {
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
  isPrerelease: boolean,
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
  if (!isPrerelease) {
    if (skippedPrereleases.length) {
      currentVersion += ` There is also a prerelease for ${skippedPrereleases[0].version}.`;
    }
    log.log(`Time to pick a new version number${packageText}.${currentVersion}`);
    log.log('');
    log.log(`Do you want to create:`);
    log.log('');
  } else {
    log.log(`Time to pick a new version number for the upcoming new release${packageText}.${currentVersion}`);
    log.log('');
    log.log(`Do you want to create a prerelease for:`);
    log.log('');
  }

  const option = await prompt.selectOption('Do you want to create', [
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

  while (true) {
    const parts = version.parse(latestVersion);
    let newVersion = '';
    if (option === 'major') {
      newVersion = `${parts[0] + 1}.0.0`;
    } else if (option === 'minor') {
      newVersion = `${parts[0]}.${parts[1] + 1}.0`;
    } else if (option === 'patch') {
      newVersion = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
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
