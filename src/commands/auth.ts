import type { Command } from 'commander';
import { oauthLogin, revokeToken } from '../oauth.js';
import { clearCredentials, getValidCredentials, loadCredentials, saveOAuthCredentials } from '../credentials.js';
import { Credentials } from '../types.js';

export function registerAuth(program: Command): void {
  const auth = program.command('auth').description('Authenticate with ZoomInfo');

  auth
    .command('login')
    .description('Authenticate to ZoomInfo via the browser')
    .action(async () => {
      const result = await oauthLogin();
      saveOAuthCredentials({
        clientId: result.clientId,
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_in: result.expires_in,
      });
      console.log('Logged in.');
    });

  auth
    .command('logout')
    .description('Revoke the current token and remove saved credentials')
    .action(async () => {
      const creds = loadCredentials();
      if (creds) {
        // Best effort: revoke the refresh token too, so the session can't be renewed.
        await Promise.allSettled([
          revokeToken(creds.refresh_token, creds.client_id, 'refresh_token'),
          revokeToken(creds.access_token, creds.client_id, 'access_token'),
        ]);
      }
      clearCredentials();
      console.log('Logged out.');
    });

  auth
    .command('whoami')
    .description('Show whether you are logged in')
    .action(async () => {
      let credentials: Credentials | null;
      try {
        credentials = await getValidCredentials();
      } catch (e) {
        // something went wrong fetching or refreshing credentials, assume credentials do not exist
        credentials = null;
      }

      const accessTokenParts = credentials?.access_token?.split('.');
      if (accessTokenParts?.length !== 3) {
        console.error('No valid user found. Run `gtm auth login` to authenticate.');
        process.exitCode = 1;
        return;
      }

      // JWT payloads are base64url-encoded UTF-8 JSON.
      const { firstName, lastName, ziUsername } = JSON.parse(Buffer.from(accessTokenParts[1], 'base64url').toString('utf8')) as { firstName: string, lastName: string, ziUsername: string };
      console.log(`Logged in as ${firstName} ${lastName} (${ziUsername})`);
    });
}
