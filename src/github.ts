import { Octokit } from '@octokit/rest';
import * as release from './release';

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

export async function CreateRelease(tagName: string, srcPath: string = '', config: GitHubConfig, releaseName?: string) {
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
  console.log(gitUrl);

  const releaseNotes = await release.generateReleaseNotes(srcPath, gitUrl, 'markdown');
  console.log(releaseNotes);
  return await octokit.rest.repos.createRelease({
    tag_name: tagName,
    name: releaseName ?? tagName,
    body: releaseNotes,
    owner: config.org,
    repo: config.repo,
    generate_release_notes: generateAutoReleaseNotes,
  });
}
