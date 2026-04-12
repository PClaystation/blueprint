# Blueprint Discord Bot + Control Center

This repo runs two things in one Node process:

- a Discord slash-command bot
- a web control center for moderators

The website now uses the Continental ID auth system from the Dashboard project. Users sign in with that account system, and Blueprint reads the Discord account linked to that Continental ID profile. Server access is then derived from guilds where:

- the bot is already installed
- the linked Discord account is a member
- that member has `Manage Server` or `Administrator`

## Slash Commands

- `/ping`
- `/hello`
- `/dashboard`

## What The Dashboard Controls

Each managed server can configure:

- the `/ping` reply text
- the `/hello` template
- whether `/hello` is enabled
- a saved accent color for that server

## Setup

1. Create a Discord application and bot in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Make sure the Dashboard auth backend is running and its Discord provider is configured.
3. In the Dashboard backend, the Blueprint origin must be allowed for OAuth app redirects.
   For local development on `localhost`, the Dashboard popup already treats local origins as trusted.
4. Copy these values:
   - bot token
   - application client ID
   - a test server ID if you want command registration to be immediate
   - the Blueprint session secret
   - the Dashboard auth API base URL
   - the login popup URL exposed by the Dashboard auth system
5. Copy `.env.example` to `.env`.
6. Fill in the environment variables.
7. Install dependencies:

```bash
npm install
```

8. Start the app:

```bash
npm start
```

9. Open the dashboard:

```text
http://localhost:3000
```

## Required Environment Variables

```text
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_SESSION_SECRET=
AUTH_API_BASE_URL=
AUTH_LOGIN_POPUP_URL=
```

## Optional Environment Variables

```text
BASE_URL=http://localhost:3000
PORT=3000
DISCORD_GUILD_ID=
AUTH_TRUSTED_LOGIN_ORIGINS=
```

## Notes

- If `DISCORD_GUILD_ID` is set, slash commands register only in that server and appear quickly.
- If `DISCORD_GUILD_ID` is omitted, slash commands register globally and can take longer to appear.
- Website login is no longer handled through a separate Discord OAuth flow in this repo.
- Blueprint depends on the authenticated Continental ID user having a linked Discord identity in Dashboard.
- The Dashboard auth API must expose the linked Discord provider user ID for this integration to resolve moderator access correctly.
- Settings are stored in `data/control-center.db`.
- `express-session` uses the default memory store, which is fine for a simple local prototype but not for production.
