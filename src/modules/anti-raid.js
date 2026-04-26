const { escapeHtml, renderModuleCard, renderModuleFacts } = require("../html");
const {
  canSendMessages,
  getChannelLabel,
  normalizeId,
  normalizeInteger,
} = require("./common");

const defaults = {
  antiRaidEnabled: false,
  antiRaidAlertChannelId: "",
  antiRaidJoinThreshold: 8,
  antiRaidJoinBurstLimit: 8,
  antiRaidWindowSeconds: 45,
  antiRaidLockdownMinutes: 10,
  antiRaidAction: "flag",
};

function normalizeAntiRaidSettings(input = {}) {
  const action = String(input.antiRaidAction || "").trim().toLowerCase();
  const normalizedAction = action === "slowmode" ? "slowmode" : "flag";

  return {
    antiRaidEnabled: input.antiRaidEnabled === true || input.antiRaidEnabled === "on",
    antiRaidAlertChannelId: normalizeId(input.antiRaidAlertChannelId),
    antiRaidJoinThreshold: normalizeInteger(input.antiRaidJoinThreshold, 8, 2, 100),
    antiRaidJoinBurstLimit: normalizeInteger(input.antiRaidJoinBurstLimit, 8, 3, 50),
    antiRaidWindowSeconds: normalizeInteger(input.antiRaidWindowSeconds, 45, 10, 600),
    antiRaidLockdownMinutes: normalizeInteger(input.antiRaidLockdownMinutes, 10, 1, 240),
    antiRaidAction: normalizedAction,
  };
}

function validateAntiRaidSettings(settings, guild, botMember) {
  if (!settings.antiRaidEnabled) {
    return [];
  }

  if (!settings.antiRaidAlertChannelId) {
    return ["Select an anti-raid alert channel before enabling this module."];
  }

  const alertChannel = guild.channels.cache.get(settings.antiRaidAlertChannelId);
  if (!canSendMessages(alertChannel, botMember)) {
    return ["Choose an alert channel where Blueprint can post anti-raid warnings."];
  }

  return [];
}

function getAntiRaidState(settings, channelOptions = []) {
  if (!settings.antiRaidEnabled) {
    return "disabled";
  }

  if (!settings.antiRaidAlertChannelId) {
    return "incomplete";
  }

  if (
    channelOptions.length > 0 &&
    !channelOptions.some((channel) => channel.id === settings.antiRaidAlertChannelId)
  ) {
    return "incomplete";
  }

  return "live";
}

function getAntiRaidStatusLabel(state) {
  if (state === "live") {
    return "Live";
  }

  if (state === "incomplete") {
    return "Needs setup";
  }

  return "Disabled";
}

function renderAntiRaidModuleCard({
  blockerText = "",
  channelOptions,
  defaultOpen = false,
  settings,
}) {
  const state = getAntiRaidState(settings, channelOptions);
  const channelSelectOptions = [
    `<option value="">Select a channel</option>`,
    ...channelOptions.map((channel) => `
      <option value="${escapeHtml(channel.id)}" ${
        settings.antiRaidAlertChannelId === channel.id ? "selected" : ""
      }>
        ${escapeHtml(channel.label)}
      </option>
    `),
  ].join("");

  const statusHtml = `
    <div class="status-pill status-pill-${state}" data-status-target="antiRaid">${escapeHtml(getAntiRaidStatusLabel(state))}</div>
  `;
  const summaryHtml = renderModuleFacts([
    {
      label: "Alert feed",
      valueHtml: escapeHtml(getChannelLabel(settings.antiRaidAlertChannelId, channelOptions)),
    },
    {
      label: "Trigger",
      valueHtml: escapeHtml(`${settings.antiRaidJoinBurstLimit} joins / ${settings.antiRaidWindowSeconds}s`),
    },
  ]);

  return renderModuleCard({
    bodyHtml: `
      <div class="module-layout">
        <div class="module-fields">
          <div class="field-grid">
            <label>
              <span>Alert channel</span>
              <select name="antiRaidAlertChannelId">
                ${channelSelectOptions}
              </select>
            </label>

            <label>
              <span>Join burst threshold</span>
              <input
                type="number"
                min="3"
                max="50"
                name="antiRaidJoinBurstLimit"
                value="${escapeHtml(String(settings.antiRaidJoinBurstLimit))}"
              />
            </label>

            <label>
              <span>Legacy join threshold</span>
              <input
                type="number"
                min="2"
                max="100"
                name="antiRaidJoinThreshold"
                value="${escapeHtml(String(settings.antiRaidJoinThreshold))}"
              />
            </label>

            <label>
              <span>Window (seconds)</span>
              <input
                type="number"
                min="10"
                max="600"
                name="antiRaidWindowSeconds"
                value="${escapeHtml(String(settings.antiRaidWindowSeconds))}"
              />
            </label>

            <label>
              <span>Lockdown minutes</span>
              <input
                type="number"
                min="1"
                max="240"
                name="antiRaidLockdownMinutes"
                value="${escapeHtml(String(settings.antiRaidLockdownMinutes))}"
              />
            </label>

            <label>
              <span>Response mode</span>
              <select name="antiRaidAction">
                <option value="flag" ${settings.antiRaidAction === "flag" ? "selected" : ""}>Flag only</option>
                <option value="slowmode" ${settings.antiRaidAction === "slowmode" ? "selected" : ""}>Flag + suggest slowmode</option>
              </select>
            </label>
          </div>
        </div>

        <aside class="preview-card">
          <span class="preview-label">Module summary</span>
          <div class="countdown-preview">${escapeHtml(getAntiRaidPreview(settings, channelOptions, state))}</div>
          <div class="preview-meta preview-meta-dual">
            <div>
              <span>Status</span>
              <strong>${escapeHtml(getAntiRaidStatusLabel(state))}</strong>
            </div>
            <div>
              <span>Response</span>
              <strong>${escapeHtml(settings.antiRaidAction === "slowmode" ? "Escalate" : "Flag")}</strong>
            </div>
          </div>
          <p class="preview-note">Blueprint watches for sudden join spikes and alerts moderators with context immediately.</p>
        </aside>
      </div>
    `,
    checked: settings.antiRaidEnabled,
    blockerHtml: escapeHtml(blockerText),
    defaultOpen,
    descriptionHtml:
      "Detect unusual join bursts and trigger moderator alerts with configurable thresholds and response guidance.",
    eyebrow: "Anti-raid",
    inputName: "antiRaidEnabled",
    moduleKey: "antiRaid",
    moduleId: "anti-raid",
    statusHtml,
    summaryHtml,
    theme: "audit",
    titleHtml: "Join-spike protection",
  });
}

module.exports = {
  defaults,
  getAntiRaidState,
  normalizeAntiRaidSettings,
  renderAntiRaidModuleCard,
  validateAntiRaidSettings,
};

function getAntiRaidPreview(settings, channelOptions, state) {
  if (state !== "live") {
    return "Anti-raid stays off until an alert channel is selected.";
  }

  const responseText =
    settings.antiRaidAction === "slowmode"
      ? `Blueprint flags the spike and suggests a ${settings.antiRaidLockdownMinutes}-minute slowdown response.`
      : "Blueprint flags the spike for moderator review.";

  return `If ${settings.antiRaidJoinBurstLimit} members join within ${settings.antiRaidWindowSeconds} seconds, Blueprint alerts ${getChannelLabel(settings.antiRaidAlertChannelId, channelOptions)}. ${responseText}`;
}
