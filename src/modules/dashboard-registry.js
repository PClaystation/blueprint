const {
  getCountdownAlertSummary,
  getCountdownResult,
  validateCountdownSettings,
} = require("../countdown");
const {
  getAnnouncementState,
  validateAnnouncementSettings,
} = require("./announcements");
const { getAuditLogState, validateAuditLogSettings } = require("./audit-log");
const {
  getAutoModerationState,
  validateAutoModerationSettings,
} = require("./auto-moderation");
const { getAutoRoleState, validateAutoRoleSettings } = require("./auto-role");
const {
  getJoinScreeningState,
  validateJoinScreeningSettings,
} = require("./join-screening");
const { getSuggestionState, validateSuggestionSettings } = require("./suggestions");
const { getStarboardState, validateStarboardSettings } = require("./starboard");
const { getWelcomeState, validateWelcomeSettings } = require("./welcome");

function evaluateDashboardModules({
  settings,
  guild,
  botMember,
  channelOptions = [],
  roleOptions = [],
  mentionRoleOptions = [],
}) {
  const countdown = getCountdownResult(settings);
  const countdownAlert = getCountdownAlertSummary(settings, channelOptions);
  const canValidate = Boolean(guild);
  const countdownErrors = canValidate
    ? validateCountdownSettings(settings, guild, botMember)
    : [];
  const welcomeErrors = canValidate ? validateWelcomeSettings(settings, guild, botMember) : [];
  const autoRoleErrors = canValidate ? validateAutoRoleSettings(settings, guild, botMember) : [];
  const auditLogErrors = canValidate ? validateAuditLogSettings(settings, guild, botMember) : [];
  const automodErrors = canValidate
    ? validateAutoModerationSettings(settings, guild, botMember)
    : [];
  const joinScreeningErrors = canValidate
    ? validateJoinScreeningSettings(settings, guild, botMember)
    : [];
  const announcementErrors = canValidate
    ? validateAnnouncementSettings(settings, guild, botMember)
    : [];
  const starboardErrors = canValidate ? validateStarboardSettings(settings, guild, botMember) : [];
  const suggestionErrors = canValidate ? validateSuggestionSettings(settings, guild, botMember) : [];

  return [
    {
      key: "countdown",
      label: "Countdown",
      enabled: settings.countdownEnabled,
      state:
        !settings.countdownEnabled
          ? "disabled"
          : countdown.state === "upcoming"
            ? "live"
            : countdown.state === "today"
              ? "today"
              : countdown.state === "past"
                ? "ended"
                : "incomplete",
      blocker:
        !settings.countdownEnabled
          ? ""
          : countdownErrors[0] ||
            (countdown.state === "incomplete"
              ? "Add an event name and target date to finish setup."
              : settings.countdownAlertEnabled && countdownAlert.state === "incomplete"
                ? "Select a countdown alert channel before enabling daily alerts."
                : ""),
    },
    {
      key: "welcome",
      label: "Welcome",
      enabled: settings.welcomeEnabled,
      state: getWelcomeState(settings, channelOptions),
      blocker:
        !settings.welcomeEnabled
          ? ""
          : welcomeErrors[0] ||
            (getWelcomeState(settings, channelOptions) === "incomplete"
              ? "Choose a welcome channel and message to finish setup."
              : ""),
    },
    {
      key: "autoRole",
      label: "Auto role",
      enabled: settings.autoRoleEnabled,
      state: getAutoRoleState(settings, roleOptions),
      blocker:
        !settings.autoRoleEnabled
          ? ""
          : autoRoleErrors[0] ||
            (getAutoRoleState(settings, roleOptions) === "incomplete"
              ? "Select a default role to finish setup."
              : ""),
    },
    {
      key: "auditLog",
      label: "Audit log",
      enabled: settings.auditLogEnabled,
      state: getAuditLogState(settings, channelOptions),
      blocker:
        !settings.auditLogEnabled
          ? ""
          : auditLogErrors[0] ||
            (getAuditLogState(settings, channelOptions) === "incomplete"
              ? "Choose a log channel and at least one tracked event."
              : ""),
    },
    {
      key: "autoModeration",
      label: "Automod",
      enabled: settings.autoModerationEnabled,
      state: getAutoModerationState(settings, channelOptions),
      blocker:
        !settings.autoModerationEnabled
          ? ""
          : automodErrors[0] ||
            (getAutoModerationState(settings, channelOptions) === "incomplete"
              ? "Turn on at least one automod rule to finish setup."
              : ""),
    },
    {
      key: "joinScreening",
      label: "Join screening",
      enabled: settings.joinScreeningEnabled,
      state: getJoinScreeningState(settings, channelOptions, roleOptions),
      blocker:
        !settings.joinScreeningEnabled
          ? ""
          : joinScreeningErrors[0] ||
            (getJoinScreeningState(settings, channelOptions, roleOptions) === "incomplete"
              ? "Choose an alert channel and, for quarantine mode, a role."
              : ""),
    },
    {
      key: "announcements",
      label: "Announcements",
      enabled: settings.announcementsEnabled,
      state: getAnnouncementState(settings, channelOptions, mentionRoleOptions),
      blocker:
        !settings.announcementsEnabled
          ? ""
          : announcementErrors[0] ||
            (getAnnouncementState(settings, channelOptions, mentionRoleOptions) === "incomplete"
              ? "Select a destination channel to finish setup."
              : ""),
    },
    {
      key: "starboard",
      label: "Highlights",
      enabled: settings.starboardEnabled,
      state: getStarboardState(settings, channelOptions),
      blocker:
        !settings.starboardEnabled
          ? ""
          : starboardErrors[0] ||
            (getStarboardState(settings, channelOptions) === "incomplete"
              ? "Select a highlight channel to finish setup."
              : ""),
    },
    {
      key: "suggestions",
      label: "Suggestions",
      enabled: settings.suggestionsEnabled,
      state: getSuggestionState(settings, channelOptions),
      blocker:
        !settings.suggestionsEnabled
          ? ""
          : suggestionErrors[0] ||
            (getSuggestionState(settings, channelOptions) === "incomplete"
              ? "Select a public suggestions channel to finish setup."
              : ""),
    },
  ];
}

module.exports = {
  evaluateDashboardModules,
};
