const fs = require("node:fs");
const path = require("node:path");

const Database = require("better-sqlite3");
const {
  DEFAULT_DAILY_ALERT_TIME,
  DEFAULT_DAILY_ALERT_TIME_ZONE,
  deserializeExcludedDates,
  deserializeWeekdays,
  normalizeCountdownAlertTime,
  normalizeCountdownAlertTimeZone,
  serializeExcludedDates,
  serializeWeekdays,
} = require("./countdown");
const { defaults: announcementDefaults } = require("./modules/announcements");
const { defaults: auditLogDefaults } = require("./modules/audit-log");
const { defaults: autoModerationDefaults } = require("./modules/auto-moderation");
const { defaults: autoRoleDefaults } = require("./modules/auto-role");
const { defaults: joinScreeningDefaults } = require("./modules/join-screening");
const { defaults: suggestionDefaults } = require("./modules/suggestions");
const { defaults: welcomeDefaults } = require("./modules/welcome");

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
    countdown_alert_enabled INTEGER NOT NULL DEFAULT 0,
    countdown_alert_channel_id TEXT NOT NULL DEFAULT '',
    countdown_alert_time TEXT NOT NULL DEFAULT '09:00',
    countdown_alert_time_zone TEXT NOT NULL DEFAULT 'UTC',
    welcome_enabled INTEGER NOT NULL DEFAULT 0,
    welcome_channel_id TEXT NOT NULL DEFAULT '',
    welcome_message_template TEXT NOT NULL DEFAULT 'Welcome to {server}, {mention}.',
    auto_role_enabled INTEGER NOT NULL DEFAULT 0,
    auto_role_role_id TEXT NOT NULL DEFAULT '',
    audit_log_enabled INTEGER NOT NULL DEFAULT 0,
    audit_log_channel_id TEXT NOT NULL DEFAULT '',
    audit_log_member_join_enabled INTEGER NOT NULL DEFAULT 1,
    audit_log_member_leave_enabled INTEGER NOT NULL DEFAULT 1,
    audit_log_message_delete_enabled INTEGER NOT NULL DEFAULT 1,
    audit_log_role_change_enabled INTEGER NOT NULL DEFAULT 0,
    auto_moderation_enabled INTEGER NOT NULL DEFAULT 0,
    auto_moderation_log_channel_id TEXT NOT NULL DEFAULT '',
    auto_moderation_block_invites INTEGER NOT NULL DEFAULT 1,
    auto_moderation_blocked_words TEXT NOT NULL DEFAULT '[]',
    auto_moderation_mention_limit INTEGER NOT NULL DEFAULT 5,
    auto_moderation_timeout_minutes INTEGER NOT NULL DEFAULT 0,
    join_screening_enabled INTEGER NOT NULL DEFAULT 0,
    join_screening_alert_channel_id TEXT NOT NULL DEFAULT '',
    join_screening_min_account_age_days INTEGER NOT NULL DEFAULT 7,
    join_screening_action TEXT NOT NULL DEFAULT 'flag',
    join_screening_quarantine_role_id TEXT NOT NULL DEFAULT '',
    announcements_enabled INTEGER NOT NULL DEFAULT 0,
    announcements_channel_id TEXT NOT NULL DEFAULT '',
    announcements_default_role_id TEXT NOT NULL DEFAULT '',
    suggestions_enabled INTEGER NOT NULL DEFAULT 0,
    suggestions_channel_id TEXT NOT NULL DEFAULT '',
    suggestions_review_channel_id TEXT NOT NULL DEFAULT '',
    suggestions_anonymous_allowed INTEGER NOT NULL DEFAULT 0,
    updated_by_user_id TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS countdown_alert_state (
    guild_id TEXT PRIMARY KEY,
    last_sent_on TEXT NOT NULL DEFAULT ''
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS suggestion_state (
    guild_id TEXT PRIMARY KEY,
    last_number INTEGER NOT NULL DEFAULT 0
  )
`);

ensureColumn("countdown_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("countdown_title", "TEXT NOT NULL DEFAULT ''");
ensureColumn("countdown_target_date", "TEXT NOT NULL DEFAULT ''");
ensureColumn("countdown_mode", "TEXT NOT NULL DEFAULT 'calendar'");
ensureColumn("countdown_weekdays", "TEXT NOT NULL DEFAULT '[1,2,3,4,5]'");
ensureColumn("countdown_excluded_dates", "TEXT NOT NULL DEFAULT '[]'");
ensureColumn("countdown_alert_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("countdown_alert_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("countdown_alert_time", `TEXT NOT NULL DEFAULT '${DEFAULT_DAILY_ALERT_TIME}'`);
ensureColumn(
  "countdown_alert_time_zone",
  `TEXT NOT NULL DEFAULT '${DEFAULT_DAILY_ALERT_TIME_ZONE}'`,
);
ensureColumn("welcome_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("welcome_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn(
  "welcome_message_template",
  "TEXT NOT NULL DEFAULT 'Welcome to {server}, {mention}.'",
);
ensureColumn("auto_role_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("auto_role_role_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("audit_log_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("audit_log_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("audit_log_member_join_enabled", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("audit_log_member_leave_enabled", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("audit_log_message_delete_enabled", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("audit_log_role_change_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("auto_moderation_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("auto_moderation_log_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("auto_moderation_block_invites", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("auto_moderation_blocked_words", "TEXT NOT NULL DEFAULT '[]'");
ensureColumn("auto_moderation_mention_limit", "INTEGER NOT NULL DEFAULT 5");
ensureColumn("auto_moderation_timeout_minutes", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("join_screening_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("join_screening_alert_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("join_screening_min_account_age_days", "INTEGER NOT NULL DEFAULT 7");
ensureColumn("join_screening_action", "TEXT NOT NULL DEFAULT 'flag'");
ensureColumn("join_screening_quarantine_role_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("announcements_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("announcements_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("announcements_default_role_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("suggestions_enabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("suggestions_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("suggestions_review_channel_id", "TEXT NOT NULL DEFAULT ''");
ensureColumn("suggestions_anonymous_allowed", "INTEGER NOT NULL DEFAULT 0");

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
  countdownAlertEnabled: false,
  countdownAlertChannelId: "",
  countdownAlertTime: DEFAULT_DAILY_ALERT_TIME,
  countdownAlertTimeZone: DEFAULT_DAILY_ALERT_TIME_ZONE,
  ...welcomeDefaults,
  ...autoRoleDefaults,
  ...auditLogDefaults,
  ...autoModerationDefaults,
  ...joinScreeningDefaults,
  ...announcementDefaults,
  ...suggestionDefaults,
};

function getGuildSettings(guildId) {
  const row = db
    .prepare("SELECT * FROM guild_settings WHERE guild_id = ?")
    .get(guildId);

  if (!row) {
    return { ...defaults };
  }

  return {
    ...defaults,
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
    countdownAlertEnabled: Boolean(row.countdown_alert_enabled),
    countdownAlertChannelId: row.countdown_alert_channel_id,
    countdownAlertTime: normalizeCountdownAlertTime(row.countdown_alert_time),
    countdownAlertTimeZone: normalizeCountdownAlertTimeZone(row.countdown_alert_time_zone),
    welcomeEnabled: Boolean(row.welcome_enabled),
    welcomeChannelId: row.welcome_channel_id,
    welcomeMessageTemplate: row.welcome_message_template,
    autoRoleEnabled: Boolean(row.auto_role_enabled),
    autoRoleRoleId: row.auto_role_role_id,
    auditLogEnabled: Boolean(row.audit_log_enabled),
    auditLogChannelId: row.audit_log_channel_id,
    auditLogMemberJoinEnabled: Boolean(row.audit_log_member_join_enabled),
    auditLogMemberLeaveEnabled: Boolean(row.audit_log_member_leave_enabled),
    auditLogMessageDeleteEnabled: Boolean(row.audit_log_message_delete_enabled),
    auditLogRoleChangeEnabled: Boolean(row.audit_log_role_change_enabled),
    autoModerationEnabled: Boolean(row.auto_moderation_enabled),
    autoModerationLogChannelId: row.auto_moderation_log_channel_id,
    autoModerationBlockInvites: Boolean(row.auto_moderation_block_invites),
    autoModerationBlockedWords: parseJsonArray(row.auto_moderation_blocked_words),
    autoModerationMentionLimit: normalizeInteger(row.auto_moderation_mention_limit, 5),
    autoModerationTimeoutMinutes: normalizeInteger(row.auto_moderation_timeout_minutes, 0),
    joinScreeningEnabled: Boolean(row.join_screening_enabled),
    joinScreeningAlertChannelId: row.join_screening_alert_channel_id,
    joinScreeningMinAccountAgeDays: normalizeInteger(
      row.join_screening_min_account_age_days,
      7,
    ),
    joinScreeningAction: row.join_screening_action || "flag",
    joinScreeningQuarantineRoleId: row.join_screening_quarantine_role_id,
    announcementsEnabled: Boolean(row.announcements_enabled),
    announcementsChannelId: row.announcements_channel_id,
    announcementsDefaultRoleId: row.announcements_default_role_id,
    suggestionsEnabled: Boolean(row.suggestions_enabled),
    suggestionsChannelId: row.suggestions_channel_id,
    suggestionsReviewChannelId: row.suggestions_review_channel_id,
    suggestionsAnonymousAllowed: Boolean(row.suggestions_anonymous_allowed),
    updatedAt: row.updated_at,
    updatedByUserId: row.updated_by_user_id,
  };
}

function saveGuildSettings(guildId, settings, updatedByUserId) {
  const values = [
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
    settings.countdownAlertEnabled ? 1 : 0,
    settings.countdownAlertChannelId,
    normalizeCountdownAlertTime(settings.countdownAlertTime),
    normalizeCountdownAlertTimeZone(settings.countdownAlertTimeZone),
    settings.welcomeEnabled ? 1 : 0,
    settings.welcomeChannelId,
    settings.welcomeMessageTemplate,
    settings.autoRoleEnabled ? 1 : 0,
    settings.autoRoleRoleId,
    settings.auditLogEnabled ? 1 : 0,
    settings.auditLogChannelId,
    settings.auditLogMemberJoinEnabled ? 1 : 0,
    settings.auditLogMemberLeaveEnabled ? 1 : 0,
    settings.auditLogMessageDeleteEnabled ? 1 : 0,
    settings.auditLogRoleChangeEnabled ? 1 : 0,
    settings.autoModerationEnabled ? 1 : 0,
    settings.autoModerationLogChannelId,
    settings.autoModerationBlockInvites ? 1 : 0,
    JSON.stringify(settings.autoModerationBlockedWords || []),
    settings.autoModerationMentionLimit,
    settings.autoModerationTimeoutMinutes,
    settings.joinScreeningEnabled ? 1 : 0,
    settings.joinScreeningAlertChannelId,
    settings.joinScreeningMinAccountAgeDays,
    settings.joinScreeningAction,
    settings.joinScreeningQuarantineRoleId,
    settings.announcementsEnabled ? 1 : 0,
    settings.announcementsChannelId,
    settings.announcementsDefaultRoleId,
    settings.suggestionsEnabled ? 1 : 0,
    settings.suggestionsChannelId,
    settings.suggestionsReviewChannelId,
    settings.suggestionsAnonymousAllowed ? 1 : 0,
    updatedByUserId,
  ];

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
      countdown_alert_enabled,
      countdown_alert_channel_id,
      countdown_alert_time,
      countdown_alert_time_zone,
      welcome_enabled,
      welcome_channel_id,
      welcome_message_template,
      auto_role_enabled,
      auto_role_role_id,
      audit_log_enabled,
      audit_log_channel_id,
      audit_log_member_join_enabled,
      audit_log_member_leave_enabled,
      audit_log_message_delete_enabled,
      audit_log_role_change_enabled,
      auto_moderation_enabled,
      auto_moderation_log_channel_id,
      auto_moderation_block_invites,
      auto_moderation_blocked_words,
      auto_moderation_mention_limit,
      auto_moderation_timeout_minutes,
      join_screening_enabled,
      join_screening_alert_channel_id,
      join_screening_min_account_age_days,
      join_screening_action,
      join_screening_quarantine_role_id,
      announcements_enabled,
      announcements_channel_id,
      announcements_default_role_id,
      suggestions_enabled,
      suggestions_channel_id,
      suggestions_review_channel_id,
      suggestions_anonymous_allowed,
      updated_by_user_id,
      updated_at
    ) VALUES (${values.map(() => "?").join(", ")}, CURRENT_TIMESTAMP)
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
      countdown_alert_enabled = excluded.countdown_alert_enabled,
      countdown_alert_channel_id = excluded.countdown_alert_channel_id,
      countdown_alert_time = excluded.countdown_alert_time,
      countdown_alert_time_zone = excluded.countdown_alert_time_zone,
      welcome_enabled = excluded.welcome_enabled,
      welcome_channel_id = excluded.welcome_channel_id,
      welcome_message_template = excluded.welcome_message_template,
      auto_role_enabled = excluded.auto_role_enabled,
      auto_role_role_id = excluded.auto_role_role_id,
      audit_log_enabled = excluded.audit_log_enabled,
      audit_log_channel_id = excluded.audit_log_channel_id,
      audit_log_member_join_enabled = excluded.audit_log_member_join_enabled,
      audit_log_member_leave_enabled = excluded.audit_log_member_leave_enabled,
      audit_log_message_delete_enabled = excluded.audit_log_message_delete_enabled,
      audit_log_role_change_enabled = excluded.audit_log_role_change_enabled,
      auto_moderation_enabled = excluded.auto_moderation_enabled,
      auto_moderation_log_channel_id = excluded.auto_moderation_log_channel_id,
      auto_moderation_block_invites = excluded.auto_moderation_block_invites,
      auto_moderation_blocked_words = excluded.auto_moderation_blocked_words,
      auto_moderation_mention_limit = excluded.auto_moderation_mention_limit,
      auto_moderation_timeout_minutes = excluded.auto_moderation_timeout_minutes,
      join_screening_enabled = excluded.join_screening_enabled,
      join_screening_alert_channel_id = excluded.join_screening_alert_channel_id,
      join_screening_min_account_age_days = excluded.join_screening_min_account_age_days,
      join_screening_action = excluded.join_screening_action,
      join_screening_quarantine_role_id = excluded.join_screening_quarantine_role_id,
      announcements_enabled = excluded.announcements_enabled,
      announcements_channel_id = excluded.announcements_channel_id,
      announcements_default_role_id = excluded.announcements_default_role_id,
      suggestions_enabled = excluded.suggestions_enabled,
      suggestions_channel_id = excluded.suggestions_channel_id,
      suggestions_review_channel_id = excluded.suggestions_review_channel_id,
      suggestions_anonymous_allowed = excluded.suggestions_anonymous_allowed,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = CURRENT_TIMESTAMP
  `).run(...values);

  return getGuildSettings(guildId);
}

function clearCountdownAlertLastSentOn(guildId) {
  db.prepare("DELETE FROM countdown_alert_state WHERE guild_id = ?").run(guildId);
}

module.exports = {
  clearCountdownAlertLastSentOn,
  defaults,
  getNextSuggestionNumber,
  getCountdownAlertLastSentOn,
  getGuildSettings,
  saveGuildSettings,
  setCountdownAlertLastSentOn,
};

function getCountdownAlertLastSentOn(guildId) {
  const row = db
    .prepare("SELECT last_sent_on FROM countdown_alert_state WHERE guild_id = ?")
    .get(guildId);

  return row?.last_sent_on || "";
}

function setCountdownAlertLastSentOn(guildId, isoDate) {
  db.prepare(`
    INSERT INTO countdown_alert_state (guild_id, last_sent_on)
    VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      last_sent_on = excluded.last_sent_on
  `).run(guildId, isoDate);
}

function getNextSuggestionNumber(guildId) {
  db.prepare(`
    INSERT INTO suggestion_state (guild_id, last_number)
    VALUES (?, 0)
    ON CONFLICT(guild_id) DO NOTHING
  `).run(guildId);

  db.prepare(`
    UPDATE suggestion_state
    SET last_number = last_number + 1
    WHERE guild_id = ?
  `).run(guildId);

  const row = db
    .prepare("SELECT last_number FROM suggestion_state WHERE guild_id = ?")
    .get(guildId);

  return row?.last_number || 1;
}

function ensureColumn(name, definition) {
  const columns = db.prepare("PRAGMA table_info(guild_settings)").all();
  if (columns.some((column) => column.name === name)) {
    return;
  }

  db.exec(`ALTER TABLE guild_settings ADD COLUMN ${name} ${definition}`);
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function normalizeInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}
