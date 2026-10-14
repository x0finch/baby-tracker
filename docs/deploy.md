# Deploying

Bobo deploys from GitHub Actions (`.github/workflows/deploy.yml`): every push to `main` that
passes CI is built, migrated and deployed to Cloudflare. You can also run **Deploy** by hand
from the Actions tab. Nothing needs to run on your computer.

Until the Cloudflare secrets below are set, the workflow skips deploying.

## One-time setup

### 1. Cloudflare

1. Sign in to the [Cloudflare dashboard](https://dash.cloudflare.com) and open
   **Workers & Pages** once, which creates your `<name>.workers.dev` subdomain.
2. Copy your **Account ID** (Workers & Pages overview, right-hand side).
3. Create an API token (**My Profile → API Tokens → Create Token**) from the
   **Edit Cloudflare Workers** template, and add **Account → D1 → Edit** to it.

### 2. GitHub secrets and variables

In the repository, open **Settings → Secrets and variables → Actions**.

Secrets:

| Name                                       | Required                  | Value                                                           |
| ------------------------------------------ | ------------------------- | --------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`                     | yes                       | the token from step 1                                           |
| `CLOUDFLARE_ACCOUNT_ID`                    | yes                       | the account ID from step 1                                      |
| `BETTER_AUTH_SECRET`                       | yes                       | a random string of 32+ characters, e.g. from a password manager |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | for Google sign-in        | from Google Cloud (below)                                       |
| `RESEND_API_KEY`                           | for password-reset emails | from [Resend](https://resend.com)                               |

Variables:

| Name         | Required             | Value                                                                               |
| ------------ | -------------------- | ----------------------------------------------------------------------------------- |
| `APP_URL`    | with a custom domain | e.g. `https://bobo.example.com`; defaults to `https://bobo.<subdomain>.workers.dev` |
| `EMAIL_FROM` | with Resend          | e.g. `Bobo <noreply@example.com>`, on a domain verified in Resend                   |

Changing `BETTER_AUTH_SECRET` later signs everyone out.

### 3. First deploy

Run **Actions → Deploy → Run workflow**. The first run creates the `bobo-db` D1 database
(Asia-Pacific), applies the migrations and deploys. The run summary shows the app URL.

## Optional: a custom domain

1. In Cloudflare, open the `bobo` Worker → **Settings → Domains & Routes → Add → Custom domain**
   (the domain must be on Cloudflare DNS).
2. Set the `APP_URL` variable to it (e.g. `https://bobo.example.com`) and re-run the deploy.

Sign-in uses `APP_URL` as the app's address. The workers.dev address keeps working too.

## Optional: Google sign-in

In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an
**OAuth client ID** of type **Web application** with:

- Authorized JavaScript origin: the app URL
- Authorized redirect URI: `<app URL>/api/auth/callback/google`

Then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` and re-run the deploy.

## Optional: password-reset emails

Sign-up and sign-in work without email. "Forgot password" needs it:

- **Free plan:** create a Resend account, verify your domain, and set `RESEND_API_KEY` and
  `EMAIL_FROM`.
- **Workers Paid:** you can use Cloudflare Email Service instead by adding
  `"send_email": [{ "name": "EMAIL" }]` to `apps/api/wrangler.jsonc`.

## Notes

- The database ID never goes into git: the workflow looks up `bobo-db` and fills it in.
- Migrations run before each deploy, so new code always meets the schema it expects.
