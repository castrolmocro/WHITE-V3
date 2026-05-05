# WHITE V3

A Facebook Messenger bot framework that lets you run a feature-rich chatbot using a personal Facebook account, with an admin web panel and user dashboard.

## Run & Operate

- **Start**: `node index.js` (watchdog → spawns `Goat.js`)
- **Required**: `account.txt` must contain valid Facebook AppState (cookies)
- **Config**: `config.json` — prefix, admins, DB type, stealth settings, E2EE pin
- **Ports**: 3001 (user dashboard), 5000 (admin web panel), 8080 (DevHub)

## Stack

- **Runtime**: Node.js 18.x
- **Messenger API**: `fca-eryxenx` (unofficial Facebook Chat API)
- **Web**: Express.js + Socket.IO + ETA templating
- **Database**: SQLite (default, via Sequelize) or MongoDB (via Mongoose)
- **E2EE**: Custom Liberty Protocol (Signal/Double Ratchet, built-in `crypto`)

## Where things live

- `index.js` — watchdog launcher with exponential backoff
- `Goat.js` — main bootstrapper (globals, DB, login)
- `config.json` — central config (source of truth for all settings)
- `account.txt` — Facebook AppState/cookies (required for login)
- `scripts/cmds/` — 100+ bot commands
- `scripts/events/` — automated event handlers
- `bot/` — core login, E2EE, stealth, MQTT logic
- `webpanel/` — admin panel (port 5000)
- `dashboard/` — user dashboard (port 3001)
- `database/` — SQLite/MongoDB models and controllers
- `languages/` — localization files (en, vi, bn)

## Architecture decisions

- Watchdog (`index.js`) spawns `Goat.js` as a child process with exponential backoff restart (max 15 restarts)
- Liberty Protocol E2EE uses only Node.js built-in `crypto` — no external crypto libraries
- Stealth engine simulates human behavior across 10 layers to avoid Facebook detection
- SQLite is default DB; MongoDB can be enabled via `config.json → database.type`
- Dashboard email features require a valid Google OAuth `refreshToken` in `config.json → credentials.gmailAccount`

## Product

- Facebook Messenger bot with 100+ commands (AI, media, admin, games, etc.)
- E2EE encrypted private/group messaging (Liberty Protocol)
- Human-behavior simulation to avoid bot detection (stealth engine)
- Admin web panel for file editing, logs, config, and AI-assisted development (DevHub)
- User dashboard for stats and basic config
- Anti-spam, anti-flood, anti-impersonation protection
- Multi-language support (EN, VI, BN)

## User preferences

- Preferred communication style: Simple, everyday language.

## Gotchas

- `account.txt` cookies expire — if you see `login_blocked`, refresh the AppState from a fresh Facebook login
- `verifyToken` must be set in `config.json → serverUptime.socket` if socket uptime is enabled
- `scripts/cmds/assets/` directory must exist or `rank.js` and `weather.js` will throw on load
- Google OAuth `refreshToken` needed for dashboard email features; leave blank to disable silently

## Pointers

- Facebook AppState guide: https://github.com/castrolmocro/New-white-e2ee-v2
- FCA API docs: https://github.com/ntkhang03/fb-chat-api/blob/master/DOCS.md
