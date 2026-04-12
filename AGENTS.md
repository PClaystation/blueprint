# AGENTS.md

## Project Overview

Blueprint is a modular, highly customizable Discord bot with a dashboard-first design.

The core idea is:
- One bot
- Many independent modules
- Every module can be enabled, disabled, and configured from the web control center
- The bot must adapt to the server, not the other way around

The codebase should always prioritize:
1. Modularity
2. Customizability
3. Clean UX
4. Stability
5. Premium feel

Do not add features that cannot be configured or disabled.

---

## Product Philosophy

Blueprint is NOT:
- A generic "do everything" bot
- A clone of Mee6, Dyno, or Carl-bot
- A pile of random features

Blueprint IS:
- A server control platform
- Modular
- Dashboard-first
- Clean and polished
- Powerful without being bloated

Every feature should feel like an installable module.

If a feature cannot reasonably be:
- turned on/off
- configured
- given sane defaults
- hidden if unused

then it should not be added.

---

## Core Principles

### Modular by default
Every major feature must live in its own module.

Examples:
- moderation
- logging
- tickets
- automations
- welcome messages
- reaction roles
- leveling
- anti-raid
- AI tools

Modules should be isolated as much as possible.

Each module should contain:
- commands
- settings schema
- dashboard UI
- permissions
- database logic
- validation

Do not tightly couple modules together unless absolutely necessary.

---

### Dashboard-first
The dashboard is the primary way users configure Blueprint.

Slash commands should exist, but only for:
- quick actions
- temporary changes
- setup shortcuts

Complex configuration should always happen in the dashboard.

Never force users to configure large systems through long slash commands.

---

### Customization requirements
Every module should support:
- enabled / disabled
- per-server settings
- permissions
- customizable messages
- customizable channels
- customizable roles
- optional advanced settings

Whenever possible, use:
- toggles
- dropdowns
- drag-and-drop ordering
- presets
- live preview

Avoid raw JSON editing unless there is no better option.

---

## UX Rules

Blueprint should feel premium and modern.

The dashboard should be:
- clean
- dark by default
- minimal
- not cluttered
- easy to understand

Avoid:
- walls of text
- giant forms
- too many settings on one page
- ugly default Discord embed styling

Users should be able to understand a module in under 30 seconds.

If there are too many options, hide advanced ones behind an expandable section.

---

## Code Style

- Prefer small, focused files
- Prefer composition over giant classes
- Avoid "god objects"
- Avoid files over ~500 lines unless justified
- Use clear names over clever names
- Write code for maintainability first

Naming:
- Components: PascalCase
- Functions/variables: camelCase
- Constants: UPPER_SNAKE_CASE
- Module folders: kebab-case

Examples:
- `ModerationModule`
- `antiRaidSettings`
- `DEFAULT_TIMEOUT_DURATION`
- `modules/moderation/`

---

## Feature Development Rules

When adding a new feature:

1. Ask:
   - What problem does this solve?
   - Why would a server want this?
   - Can this be a module?
   - How is it configured?
   - How is it disabled?
   - What is the minimum useful version?

2. Always implement:
   - dashboard UI
   - server-side validation
   - default settings
   - permission checks
   - error handling

3. Do NOT:
   - hardcode server IDs, channels, roles, or values
   - create features with no settings
   - create giant all-in-one configuration pages
   - add a feature "just because other bots have it"

---

## Commands

Slash commands should:
- be short
- be clean
- avoid unnecessary subcommands
- point users toward the dashboard for advanced setup

Example:
`/tickets setup` is acceptable.

A 14-option slash command with nested arguments is not.

---

## Database Rules

Each module should store its own configuration separately.

Preferred structure:
- one table per module
- linked by guild/server ID

Avoid:
- one massive settings table
- storing unrelated module data together

Settings should be versioned or easily migratable.

---

## Testing

Before considering a feature complete, verify:
- module can be enabled and disabled
- settings save correctly
- permissions work
- invalid settings fail safely
- dashboard UI still works on small screens
- the module does not break when missing optional config

Always test both:
- fresh server with defaults
- heavily customized server

---

## Security

Never trust client-side validation.

Always validate:
- permissions
- IDs
- role hierarchy
- channel existence
- Discord API responses

Do not allow:
- arbitrary code execution
- unsafe eval
- insecure webhook handling
- dashboard access without proper auth

All server configuration changes must be permission checked.

---

## What Codex Should Optimize For

When multiple approaches are possible, prefer the one that is:
1. More modular
2. Easier to configure
3. Easier to extend later
4. Cleaner in the dashboard
5. Less confusing for the end user