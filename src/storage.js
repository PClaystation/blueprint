const fs = require("node:fs");
const path = require("node:path");

const Database = require("better-sqlite3");
const {
  deserializeExcludedDates,
  deserializeWeekdays,
  serializeExcludedDates,
  serializeWeekdays,
} = require("./countdown");

const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "control-center.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    ping_response TEXT NOT NULL DEFAULT 'Pong.',
    hello_enabled INTEGER NOT NULL DEFAULT 1,
    hello_template TEXT NOT NULL DEFAULT 'Hello, {user}.',
    accent_color TEXT NOT NULL DEFAULT '#5865f2',
    countdown_enabled INTEGER NOT NULL DEFAULT 0,
    countdown_title TEXT NOT NULL DEFAULT '',
    countdown_target_date TEXT NOT NULL DEFAULT '',
    countdown_mode TEXT NOT NULL DEFAULT 'calendar',
    countdown_weekdays TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
    countdown_excluded_dates TEXT NOT NULL DEFAULT '[]',
    updated_by_user_id TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

ensureColumn("countdown_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("countdown_title", "TEXT NOT NULL DEFAULT ''");
ensureColumn("countdown_target_date", "TEXT NOT NULL DEFAULT ''");
ensureColumn("countdown_mode", "TEXT NOT NULL DEFAULT 'calendar'");
ensureColumn("countdown_weekdays", "TEXT NOT NULL DEFAULT '[1,2,3,4,5]'");
ensureColumn("countdown_excluded_dates", "TEXT NOT NULL DEFAULT '[]'");

const defaults = {
  pingResponse: "Pong.",
  helloEnabled: true,
  helloTemplate: "Hello, {user}.",
  accentColor: "#5865f2",
  countdownEnabled: false,
  countdownTitle: "",
  countdownTargetDate: "",
  countdownMode: "calendar",
  countdownWeekdays: [1, 2, 3, 4, 5],
  countdownExcludedDates: [],
};

function getGuildSettings(guildId) {
  const row = db
    .prepare("SELECT * FROM guild_settings WHERE guild_id = ?")
    .get(guildId);

  if (!row) {
    return { ...defaults };
  }

  return {
    pingResponse: row.ping_response,
    helloEnabled: Boolean(row.hello_enabled),
    helloTemplate: row.hello_template,
    accentColor: row.accent_color,
    countdownEnabled: Boolean(row.countdown_enabled),
    countdownTitle: row.countdown_title,
    countdownTargetDate: row.countdown_target_date,
    countdownMode: row.countdown_mode,
    countdownWeekdays: deserializeWeekdays(row.countdown_weekdays),
    countdownExcludedDates: deserializeExcludedDates(row.countdown_excluded_dates),
    updatedAt: row.updated_at,
    updatedByUserId: row.updated_by_user_id,
  };
}

function saveGuildSettings(guildId, settings, updatedByUserId) {
  db.prepare(`
    INSERT INTO guild_settings (
      guild_id,
      ping_response,
      hello_enabled,
      hello_template,
      accent_color,
      countdown_enabled,
      countdown_title,
      countdown_target_date,
      countdown_mode,
      countdown_weekdays,
      countdown_excluded_dates,
      updated_by_user_id,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(guild_id) DO UPDATE SET
      ping_response = excluded.ping_response,
      hello_enabled = excluded.hello_enabled,
      hello_template = excluded.hello_template,
      accent_color = excluded.accent_color,
      countdown_enabled = excluded.countdown_enabled,
      countdown_title = excluded.countdown_title,
      countdown_target_date = excluded.countdown_target_date,
      countdown_mode = excluded.countdown_mode,
      countdown_weekdays = excluded.countdown_weekdays,
      countdown_excluded_dates = excluded.countdown_excluded_dates,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    guildId,
    settings.pingResponse,
    settings.helloEnabled ? 1 : 0,
    settings.helloTemplate,
    settings.accentColor,
    settings.countdownEnabled ? 1 : 0,
    settings.countdownTitle,
    settings.countdownTargetDate,
    settings.countdownMode,
    serializeWeekdays(settings.countdownWeekdays),
    serializeExcludedDates(settings.countdownExcludedDates),
    updatedByUserId,
  );

  return getGuildSettings(guildId);
}

module.exports = {
  defaults,
  getGuildSettings,
  saveGuildSettings,
};

function ensureColumn(name, definition) {
  const columns = db.prepare("PRAGMA table_info(guild_settings)").all();
  if (columns.some((column) => column.name === name)) {
    return;
  }

  db.exec(`ALTER TABLE guild_settings ADD COLUMN ${name} ${definition}`);
}
