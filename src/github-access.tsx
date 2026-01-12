import * as log from './logging';
import * as chalk from 'chalk';
import * as open from 'open';
import { fetch } from 'cross-fetch';

const GITHUB_ACCESS_TOKEN_ENV_NAME = 'Github__OAuthAccessToken';

type OAuthReturn = {
  access_token: string;
  scope: string;
  token_type: string;
};

type DeviceCode = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
};

export class GithubAccess {
  // "avensia-oss-garn-oauth" oauth app. This app lives in the avensia-oss organization.
  private static OAuthClientId = '825e1cb8ef39aa07f127';

  public static async getAccessToken() {
    const keytar = await import('keytar');
    const token = await keytar.findPassword(GITHUB_ACCESS_TOKEN_ENV_NAME);
    return token;
  }

  public static async setAccessToken(token: string) {
    const keytar = await import('keytar');
    return await keytar.setPassword(GITHUB_ACCESS_TOKEN_ENV_NAME, GithubAccess.OAuthClientId, token);
  }

  public static async clearAccessToken() {
    const keytar = await import('keytar');
    return await keytar.deletePassword(GITHUB_ACCESS_TOKEN_ENV_NAME, GithubAccess.OAuthClientId);
  }

  public static async hasCredentials(): Promise<boolean> {
    return !!(await GithubAccess.getAccessToken());
  }

  public static async validateCredentials() {
    if (!(await GithubAccess.hasCredentials())) {
      try {
        await GithubAccess.captureCredentials();
      } catch (e) {
        throw new Error(`Failed to capture github credentials: ${e}`);
      }
    }
  }

  private static async captureCredentials() {
    const promise = new Promise(async (resolve, reject) => {
      const authUrl = new URL('https://github.com/login/device/code');
      authUrl.searchParams.set('client_id', GithubAccess.OAuthClientId);
      authUrl.searchParams.set('scope', 'repo');

      try {
        const codeRequest = await fetch(authUrl.toString(), {
          method: 'POST',
          headers: {
            Accept: 'application/json',
          },
        });
        const deviceConfig: DeviceCode = await codeRequest.json();
        log.log('');
        log.log(chalk.bold.green('!'), chalk.bold('Garn needs access to github.'));
        log.log(chalk.bold.green('!'), 'A browser tab have been opened.');
        log.log(
          chalk.bold.green('!'),
          chalk.bold(`Please enter the following code into the new tab: ${chalk.blue(deviceConfig.user_code)}`),
        );
        log.log(chalk.bold.green('!'), 'Return here when done.');
        log.log('');

        // Open browser tab which prompts user to enter the device code and then authorize the garn app.
        open('https://github.com/login/device');

        const pollCaptureUrl = new URL('https://github.com/login/oauth/access_token');
        pollCaptureUrl.searchParams.set('client_id', GithubAccess.OAuthClientId);
        pollCaptureUrl.searchParams.set('device_code', deviceConfig.device_code);
        pollCaptureUrl.searchParams.set('grant_type', 'urn:ietf:params:oauth:grant-type:device_code');

        log.log(`Checking if access was granted, every ${deviceConfig.interval} seconds...`);
        log.log('');

        const pollInterval = deviceConfig.interval * 1000 + 100; // 100 ms padding here so we don't trigger slow_down-error.
        const intervalId = setInterval(async () => {
          try {
            const pollRequest = await fetch(pollCaptureUrl.toString(), {
              method: 'POST',
              headers: {
                Accept: 'application/json',
              },
            });

            const tokenCapture: OAuthReturn = await pollRequest.json();

            if (tokenCapture.access_token) {
              GithubAccess.setAccessToken(tokenCapture.access_token);
              clearInterval(intervalId);
              log.log(chalk.bold.green('!', 'Github authentication successful!'));
              log.log('');
              resolve(true);
            }
          } catch (e) {
            log.error(chalk.red.bold('!', `Failed to fetch access token: ${e}`));
          }
        }, pollInterval);
      } catch (e) {
        throw new Error(`Failed to fetch device code: ${e}`);
      }
    });

    return promise;
  }
}
