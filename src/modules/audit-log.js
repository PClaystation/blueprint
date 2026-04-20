const { escapeHtml, renderModuleCard, renderModuleFacts } = require("../html");
const {
  canSendMessages,
  getChannelLabel,
  normalizeId,
} = require("./common");

const AUDIT_EVENTS = [
  { key: "auditLogMemberJoinEnabled", label: "Member joins" },
  { key: "auditLogMemberLeaveEnabled", label: "Member leaves" },
  { key: "auditLogMessageDeleteEnabled", label: "Deleted messages" },
  { key: "auditLogRoleChangeEnabled", label: "Role changes" },
];

const defaults = {
  auditLogEnabled: false,
  auditLogChannelId: "",
  auditLogMemberJoinEnabled: true,
  auditLogMemberLeaveEnabled: true,
  auditLogMessageDeleteEnabled: true,
  auditLogRoleChangeEnabled: false,
};

function normalizeAuditLogSettings(input = {}) {
  return {
    auditLogEnabled: input.auditLogEnabled === true || input.auditLogEnabled === "on",
    auditLogChannelId: normalizeId(input.auditLogChannelId),
    auditLogMemberJoinEnabled:
      input.auditLogMemberJoinEnabled === true || input.auditLogMemberJoinEnabled === "on",
    auditLogMemberLeaveEnabled:
      input.auditLogMemberLeaveEnabled === true || input.auditLogMemberLeaveEnabled === "on",
    auditLogMessageDeleteEnabled:
      input.auditLogMessageDeleteEnabled === true || input.auditLogMessageDeleteEnabled === "on",
    auditLogRoleChangeEnabled:
      input.auditLogRoleChangeEnabled === true || input.auditLogRoleChangeEnabled === "on",
  };
}

function validateAuditLogSettings(settings, guild, botMember) {
  if (!settings.auditLogEnabled) {
    return [];
  }

  if (!settings.auditLogChannelId) {
    return ["Select an audit log channel before enabling this module."];
  }

  if (!getEnabledAuditEvents(settings).length) {
    return ["Choose at least one audit event before enabling audit logging."];
  }

  const channel = guild.channels.cache.get(settings.auditLogChannelId);
  if (!canSendMessages(channel, botMember)) {
    return ["Blueprint needs a text channel where it can post audit log updates."];
  }

  return [];
}

function getAuditLogState(settings, channelOptions = []) {
  if (!settings.auditLogEnabled) {
    return "disabled";
  }

  if (!settings.auditLogChannelId || getEnabledAuditEvents(settings).length === 0) {
    return "incomplete";
  }

  if (
    channelOptions.length > 0 &&
    !channelOptions.some((channel) => channel.id === settings.auditLogChannelId)
  ) {
    return "incomplete";
  }

  return "live";
}

function getAuditLogStatusLabel(state) {
  if (state === "live") {
    return "Live";
  }

  if (state === "incomplete") {
    return "Needs setup";
  }

  return "Disabled";
}

function renderAuditLogModuleCard({
  blockerText = "",
  channelOptions,
  defaultOpen = false,
  settings,
}) {
  const state = getAuditLogState(settings, channelOptions);
  const channelSelectOptions = [
    `<option value="">Select a channel</option>`,
    ...channelOptions.map((channel) => `
      <option value="${escapeHtml(channel.id)}" ${
        settings.auditLogChannelId === channel.id ? "selected" : ""
      }>
        ${escapeHtml(channel.label)}
      </option>
    `),
  ].join("");
  const eventCheckboxes = AUDIT_EVENTS.map((event) => `
    <label class="checkbox-chip checkbox-chip-block">
      <input
        type="checkbox"
        name="${event.key}"
        value="on"
        ${settings[event.key] ? "checked" : ""}
      />
      <span>${escapeHtml(event.label)}</span>
    </label>
  `).join("");
  const enabledEvents = getEnabledAuditEvents(settings);
  const statusHtml = `
    <div class="status-pill status-pill-${state}" data-status-target="auditLog">${escapeHtml(getAuditLogStatusLabel(state))}</div>
  `;
  const summaryHtml = renderModuleFacts([
    {
      label: "Destination",
      valueHtml: escapeHtml(getChannelLabel(settings.auditLogChannelId, channelOptions)),
    },
    {
      label: "Coverage",
      valueHtml: escapeHtml(
        enabledEvents.length ? `${enabledEvents.length} event${enabledEvents.length === 1 ? "" : "s"}` : "Not configured",
      ),
    },
  ]);

  return renderModuleCard({
    bodyHtml: `
      <div class="module-layout">
        <div class="module-fields">
          <div class="field-grid">
            <label>
              <span>Audit log channel</span>
              <select name="auditLogChannelId">
                ${channelSelectOptions}
              </select>
            </label>
          </div>
          <div class="subsection">
            <span class="subsection-label">Track these events</span>
            <div class="checkbox-chip-grid">
              ${eventCheckboxes}
            </div>
          </div>
        </div>

        <aside class="preview-card">
          <span class="preview-label">Module summary</span>
          <div class="countdown-preview">${escapeHtml(getAuditLogPreview(settings, channelOptions, state))}</div>
          <div class="preview-meta preview-meta-dual">
            <div>
              <span>Channel</span>
              <strong>${escapeHtml(getChannelLabel(settings.auditLogChannelId, channelOptions))}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>${escapeHtml(getAuditLogStatusLabel(state))}</strong>
            </div>
          </div>
          <p class="preview-note">Audit logs are notification-only and never change server state.</p>
        </aside>
      </div>
    `,
    checked: settings.auditLogEnabled,
    blockerHtml: escapeHtml(blockerText),
    defaultOpen,
    descriptionHtml:
      "Post a clean moderation trail when members join, leave, delete messages, or receive role changes.",
    eyebrow: "Audit log",
    inputName: "auditLogEnabled",
    moduleKey: "auditLog",
    moduleId: "audit-log",
    statusHtml,
    summaryHtml,
    theme: "audit-log",
    titleHtml: "Server audit feed",
  });
}

async function logMemberJoin(member, settings) {
  if (!settings.auditLogEnabled || !settings.auditLogMemberJoinEnabled || member.user.bot) {
    return;
  }

  await sendAuditLog(
    member.guild,
    settings,
    [
      `Member joined: ${member.user.tag} (${member.id})`,
      `Mention: <@${member.id}>`,
      `Created: <t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`,
    ].join("\n"),
  );
}

async function logMemberLeave(member, settings) {
  if (!settings.auditLogEnabled || !settings.auditLogMemberLeaveEnabled || member.user.bot) {
    return;
  }

  await sendAuditLog(
    member.guild,
    settings,
    [`Member left: ${member.user.tag} (${member.id})`, `Mention: <@${member.id}>`].join("\n"),
  );
}

async function logMessageDelete(message, settings) {
  if (
    !settings.auditLogEnabled ||
    !settings.auditLogMessageDeleteEnabled ||
    !message.guild ||
    message.author?.bot
  ) {
    return;
  }

  const content = summarizeDeletedMessage(message);
  await sendAuditLog(
    message.guild,
    settings,
    [
      `Message deleted in <#${message.channelId}>`,
      `Author: ${message.author?.tag || "Unknown user"} (${message.author?.id || "unknown"})`,
      `Content: ${content}`,
    ].join("\n"),
  );
}

async function logRoleChange(oldMember, newMember, settings) {
  if (
    !settings.auditLogEnabled ||
    !settings.auditLogRoleChangeEnabled ||
    !newMember.guild
  ) {
    return;
  }

  const previousRoles = new Set(oldMember.roles.cache.keys());
  const nextRoles = new Set(newMember.roles.cache.keys());
  const addedRoles = newMember.roles.cache
    .filter((role) => !previousRoles.has(role.id) && role.id !== newMember.guild.id)
    .sort((left, right) => right.position - left.position)
    .map((role) => role.name);
  const removedRoles = oldMember.roles.cache
    .filter((role) => !nextRoles.has(role.id) && role.id !== newMember.guild.id)
    .sort((left, right) => right.position - left.position)
    .map((role) => role.name);

  if (addedRoles.length === 0 && removedRoles.length === 0) {
    return;
  }

  await sendAuditLog(
    newMember.guild,
    settings,
    [
      `Roles updated for ${newMember.user.tag} (${newMember.id})`,
      addedRoles.length ? `Added: ${addedRoles.join(", ")}` : "",
      removedRoles.length ? `Removed: ${removedRoles.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

module.exports = {
  defaults,
  getAuditLogState,
  getAuditLogStatusLabel,
  logMemberJoin,
  logMemberLeave,
  logMessageDelete,
  logRoleChange,
  normalizeAuditLogSettings,
  renderAuditLogModuleCard,
  validateAuditLogSettings,
};

function getEnabledAuditEvents(settings) {
  return AUDIT_EVENTS.filter((event) => settings[event.key]);
}

function getAuditLogPreview(settings, channelOptions, state) {
  if (state !== "live") {
    return "Audit logs stay off until a destination channel and at least one event type are selected.";
  }

  return `Blueprint posts ${getEnabledAuditEvents(settings)
    .map((event) => event.label.toLowerCase())
    .join(", ")} in ${getChannelLabel(settings.auditLogChannelId, channelOptions)}.`;
}

function summarizeDeletedMessage(message) {
  const raw = String(message.content || "").trim();
  if (!raw && message.attachments.size > 0) {
    return `${message.attachments.size} attachment${message.attachments.size === 1 ? "" : "s"}`;
  }

  if (!raw) {
    return "Unavailable";
  }

  return raw.length > 320 ? `${raw.slice(0, 317)}...` : raw;
}

async function sendAuditLog(guild, settings, content) {
  const channel = guild.channels.cache.get(settings.auditLogChannelId);
  const botMember = await guild.members.fetchMe().catch(() => guild.members.me || null);
  if (!canSendMessages(channel, botMember)) {
    return;
  }

  await channel.send({
    allowedMentions: { parse: [] },
    content,
  });
}
