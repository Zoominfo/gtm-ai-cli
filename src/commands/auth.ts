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
        try { await revokeToken(creds.access_token, creds.client_id); } catch { /* best effort */ }
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

      if (!credentials) {
        console.log('No valid user found. Run `gtm auth login` to authenticate.');
        return;
      }

      const accessTokenParts = credentials?.access_token?.split('.');
      if ((accessTokenParts?.length ?? 0) !== 3) {
        console.log('No valid user found. Run `gtm auth login` to authenticate.');
        return;
      }

      const { firstName, lastName, ziUsername } = JSON.parse(atob(accessTokenParts[1])) as { firstName: string, lastName: string, ziUsername: string };
      console.log(`Logged in as ${firstName} ${lastName} (${ziUsername})`);
    });
}
