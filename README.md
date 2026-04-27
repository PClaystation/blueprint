# Blueprint

Blueprint is a modular, dashboard-first Discord bot and control center.

This repository runs two connected surfaces in one Node process:

- the Discord bot
- the Blueprint website and dashboard

The product goal is a real server-control platform, not a pile of commands. Each major feature should feel like an installable module with its own settings, validation, permissions, and dashboard UI.

## Website Essentials

The web layer now includes the baseline public-site files and routes expected from a production website:

- `/privacy`
- `/terms`
- `/contact`
- `/robots.txt`
- `/sitemap.xml`
- `/security.txt`
- `/.well-known/security.txt`
- `/site.webmanifest`
- a custom 404 page
- SEO and social metadata in the shared layout

These sit alongside the authenticated dashboard rather than being separate static mock pages.

## Core Product Shape

Blueprint is designed around:

- modular server features
- dashboard-first configuration
- per-server settings
- configurable enable/disable states
- clean operator UX

Examples of managed modules in this repo include:

- welcome flows
- auto roles
- countdowns
- audit log
- auto moderation
- announcements
- starboard
- suggestions
- reaction roles
- tickets
- leveling
- anti-raid
- automations
- modmail
- applications
- AI tools

## Slash Commands

Current slash commands:

- `/ping`
- `/hello`
- `/dashboard`
- `/countdown`
- `/announce`
- `/suggest`

Complex setup belongs in the website, not in oversized slash-command trees.

## Access Model

Blueprint uses the Continental ID auth flow for website access.

Users sign in with Continental ID, Blueprint reads the linked Discord identity from that authenticated profile, and the dashboard only exposes servers where:

- the bot is installed
- the linked Discord account is a member
- that member has `Manage Server` or `Administrator`

## Local Development

1. Create a Discord application and bot in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Enable the `Server Members Intent` for the bot.
3. Make sure the Dashboard auth backend is running and its Discord provider is configured.
4. Allow the Blueprint origin in the Dashboard auth backend redirect settings.
5. Install dependencies:

```bash
npm install
```

6. Set the required environment variables.
7. Start the app:

```bash
npm start
```

8. Open:

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

## Storage

- Guild configuration is stored in `data/control-center.db`.
- Session handling uses `express-session`.
- The current default session store is acceptable for local development, but should be replaced for real production deployment.

## Testing

Run the current automated tests with:

```bash
npm test
```

When shipping module work, also verify:

- module enable/disable behavior
- invalid setting handling
- permission checks
- mobile dashboard usability
- sane defaults on a fresh server
- behavior on a heavily customized server

## Security

See [SECURITY.md](SECURITY.md) for reporting guidance. The running app also publishes a machine-readable security contact at `/security.txt`.
