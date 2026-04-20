const { escapeHtml, renderModuleCard, renderModuleFacts } = require("../html");
const {
  canSendMessages,
  getChannelLabel,
  getRoleLabel,
  normalizeId,
} = require("./common");

const defaults = {
  announcementsEnabled: false,
  announcementsChannelId: "",
  announcementsDefaultRoleId: "",
};

function normalizeAnnouncementSettings(input = {}) {
  return {
    announcementsEnabled:
      input.announcementsEnabled === true || input.announcementsEnabled === "on",
    announcementsChannelId: normalizeId(input.announcementsChannelId),
    announcementsDefaultRoleId: normalizeId(input.announcementsDefaultRoleId),
  };
}

function validateAnnouncementSettings(settings, guild, botMember) {
  if (!settings.announcementsEnabled) {
    return [];
  }

  if (!settings.announcementsChannelId) {
    return ["Select an announcement channel before enabling this module."];
  }

  const channel = guild.channels.cache.get(settings.announcementsChannelId);
  if (!canSendMessages(channel, botMember)) {
    return ["Choose an announcement channel where Blueprint can post messages."];
  }

  if (
    settings.announcementsDefaultRoleId &&
    !guild.roles.cache.has(settings.announcementsDefaultRoleId)
  ) {
    return ["The default announcement role no longer exists in this server."];
  }

  return [];
}

function getAnnouncementState(settings, channelOptions = [], roleOptions = []) {
  if (!settings.announcementsEnabled) {
    return "disabled";
  }

  if (!settings.announcementsChannelId) {
    return "incomplete";
  }

  if (
    channelOptions.length > 0 &&
    !channelOptions.some((channel) => channel.id === settings.announcementsChannelId)
  ) {
    return "incomplete";
  }

  if (
    settings.announcementsDefaultRoleId &&
    roleOptions.length > 0 &&
    !roleOptions.some((role) => role.id === settings.announcementsDefaultRoleId)
  ) {
    return "incomplete";
  }

  return "live";
}

function getAnnouncementStatusLabel(state) {
  if (state === "live") {
    return "Live";
  }

  if (state === "incomplete") {
    return "Needs setup";
  }

  return "Disabled";
}

function renderAnnouncementModuleCard({
  blockerText = "",
  channelOptions,
  defaultOpen = false,
  mentionRoleOptions,
  settings,
}) {
  const state = getAnnouncementState(settings, channelOptions, mentionRoleOptions);
  const channelSelectOptions = [
    `<option value="">Select a channel</option>`,
    ...channelOptions.map((channel) => `
      <option value="${escapeHtml(channel.id)}" ${
        settings.announcementsChannelId === channel.id ? "selected" : ""
      }>
        ${escapeHtml(channel.label)}
      </option>
    `),
  ].join("");
  const roleSelectOptions = [
    `<option value="">No default role ping</option>`,
    ...mentionRoleOptions.map((role) => `
      <option value="${escapeHtml(role.id)}" ${
        settings.announcementsDefaultRoleId === role.id ? "selected" : ""
      }>
        ${escapeHtml(role.label)}
      </option>
    `),
  ].join("");
  const statusHtml = `
    <div class="status-pill status-pill-${state}" data-status-target="announcements">${escapeHtml(getAnnouncementStatusLabel(state))}</div>
  `;
  const summaryHtml = renderModuleFacts([
    {
      label: "Destination",
      valueHtml: escapeHtml(getChannelLabel(settings.announcementsChannelId, channelOptions)),
    },
    {
      label: "Default ping",
      valueHtml: escapeHtml(getRoleLabel(settings.announcementsDefaultRoleId, mentionRoleOptions)),
    },
  ]);

  return renderModuleCard({
    bodyHtml: `
      <div class="module-layout">
        <div class="module-fields">
          <div class="field-grid">
            <label>
              <span>Announcement channel</span>
              <select name="announcementsChannelId">
                ${channelSelectOptions}
              </select>
            </label>

            <label>
              <span>Default role ping</span>
              <select name="announcementsDefaultRoleId">
                ${roleSelectOptions}
              </select>
              <small>The <code>/announce</code> command can optionally ping this role.</small>
            </label>
          </div>
        </div>

        <aside class="preview-card">
          <span class="preview-label">Module summary</span>
          <div class="countdown-preview">${escapeHtml(getAnnouncementPreview(settings, channelOptions, mentionRoleOptions, state))}</div>
          <div class="preview-meta preview-meta-dual">
            <div>
              <span>Channel</span>
              <strong>${escapeHtml(getChannelLabel(settings.announcementsChannelId, channelOptions))}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>${escapeHtml(getAnnouncementStatusLabel(state))}</strong>
            </div>
          </div>
          <p class="preview-note">Use <code>/announce</code> for quick staff broadcasts without hardcoding a channel each time.</p>
        </aside>
      </div>
    `,
    checked: settings.announcementsEnabled,
    blockerHtml: escapeHtml(blockerText),
    defaultOpen,
    descriptionHtml:
      "Give staff one clean place to publish server-wide updates, with an optional default role ping.",
    eyebrow: "Announcements",
    inputName: "announcementsEnabled",
    moduleKey: "announcements",
    moduleId: "announcements",
    statusHtml,
    summaryHtml,
    theme: "announcements",
    titleHtml: "Staff broadcast channel",
  });
}

module.exports = {
  defaults,
  getAnnouncementState,
  getAnnouncementStatusLabel,
  normalizeAnnouncementSettings,
  renderAnnouncementModuleCard,
  validateAnnouncementSettings,
};

function getAnnouncementPreview(settings, channelOptions, mentionRoleOptions, state) {
  if (state !== "live") {
    return "Announcements stay off until a delivery channel is selected.";
  }

  const pingRole = settings.announcementsDefaultRoleId
    ? ` with optional ping ${getRoleLabel(settings.announcementsDefaultRoleId, mentionRoleOptions)}`
    : "";

  return `Staff can publish updates into ${getChannelLabel(
    settings.announcementsChannelId,
    channelOptions,
  )}${pingRole}.`;
}
