const fs = require("node:fs");
const path = require("node:path");

const Database = require("better-sqlite3");

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
    updated_by_user_id TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

const defaults = {
  pingResponse: "Pong.",
  helloEnabled: true,
  helloTemplate: "Hello, {user}.",
  accentColor: "#5865f2",
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
      updated_by_user_id,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(guild_id) DO UPDATE SET
      ping_response = excluded.ping_response,
      hello_enabled = excluded.hello_enabled,
      hello_template = excluded.hello_template,
      accent_color = excluded.accent_color,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    guildId,
    settings.pingResponse,
    settings.helloEnabled ? 1 : 0,
    settings.helloTemplate,
    settings.accentColor,
    updatedByUserId,
  );

  return getGuildSettings(guildId);
}

module.exports = {
  defaults,
  getGuildSettings,
  saveGuildSettings,
};
