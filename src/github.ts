import { Octokit } from '@octokit/rest';
import { changelog, git } from '.';
import * as os from 'os';
import { GithubAccess } from './github-access';

export type LogLevel = 'debug' | 'warn' | 'info' | 'error';

export type GitHubConfig = {
  auth: string;
  repo: string;
  org: string;
  app?: string;
  timezone?: string;
  baseUrl?: string;
  logLevel?: LogLevel;
  generateAutoReleaseNotes?: boolean;
};

export async function CreateRelease(
  tagName: string,
  previousTag: string,
  srcPath: string = '',
  config: GitHubConfig,
  releaseName?: string,
) {
  const userAgent = `${config.app ?? 'garn/oss'} ${config.org} `.trim();
  const generateAutoReleaseNotes = config.generateAutoReleaseNotes ?? false;

  const octokit = new Octokit({
    auth: config.auth,
    userAgent: userAgent,
    timezone: config.timezone ?? 'Europe/Stockholm',
    baseUrl: config.baseUrl ?? 'https://api.github.com',
    generateAutoReleaseNotes: generateAutoReleaseNotes,
    log: {
      debug: () => ((config.logLevel ?? '') == 'debug' ? console.debug : {}),
      info: () => ((config.logLevel ?? '') == 'info' ? console.info : {}),
      warn: console.warn,
      error: console.error,
    },
  });

  const gitUrl = `https://github.com/${config.org}/${config.repo}/`;
  const releaseNotes = await generateReleaseNotes(tagName, previousTag, srcPath, gitUrl, 'markdown');
  await octokit.rest.repos.createRelease({
    tag_name: tagName,
    name: releaseName ?? tagName,
    body: releaseNotes,
    owner: config.org,
    repo: config.repo,
    generate_release_notes: generateAutoReleaseNotes,
  });

  async function generateReleaseNotes(
    toTag: string,
    fromTag: string,
    workspaceSrcPath: string,
    repoUrl: string,
    format: changelog.ChangeLogFormat = 'markdown',
  ) {
    const packageResult = await git.logBetween({
      to: toTag,
      from: fromTag,
      path: workspaceSrcPath,
    });

    let formattedOutput: string[] = changelog.formatTitle(toTag, repoUrl, format);
    packageResult.forEach(commit => {
      formattedOutput.push(...changelog.formatCommit(commit, repoUrl, format));
    });

    return formattedOutput.join(os.EOL);
  }
}

type GithubConfig = {
  organization: string;
  repo: string;
  branch?: string;
};

export async function findPrForCurrentBranch({ organization, repo, branch }: GithubConfig) {
  await GithubAccess.validateCredentials();
  const octokit = new Octokit({
    auth: await GithubAccess.getAccessToken(),
  });
  const currentBranch = branch ?? (await git.getCurrentBranchName());
  const prs = await octokit.rest.pulls.list({
    owner: organization,
    repo,
    head: `${organization}:${currentBranch}`,
  });

  return prs.data;
}
