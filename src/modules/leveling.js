const { escapeHtml, renderModuleCard, renderModuleFacts } = require("../html");
const {
  canSendMessages,
  getChannelLabel,
  normalizeId,
  normalizeInteger,
  normalizeText,
} = require("./common");

const defaults = {
  levelingEnabled: false,
  levelingAnnounceChannelId: "",
  levelingXpPerMessage: 15,
  levelingCooldownSeconds: 60,
  levelingLevelUpMessage: "GG {mention}, you're now level {level}!",
};

function normalizeLevelingSettings(input = {}) {
  return {
    levelingEnabled: input.levelingEnabled === true || input.levelingEnabled === "on",
    levelingAnnounceChannelId: normalizeId(input.levelingAnnounceChannelId),
    levelingXpPerMessage: normalizeInteger(input.levelingXpPerMessage, 15, 5, 50),
    levelingCooldownSeconds: normalizeInteger(input.levelingCooldownSeconds, 60, 0, 300),
    levelingLevelUpMessage: normalizeText(
      input.levelingLevelUpMessage,
      defaults.levelingLevelUpMessage,
      180,
    ),
  };
}

function validateLevelingSettings(settings, guild, botMember) {
  if (!settings.levelingEnabled) {
    return [];
  }

  if (!settings.levelingAnnounceChannelId) {
    return ["Select a level-up announcement channel before enabling this module."];
  }

  const announceChannel = guild.channels.cache.get(settings.levelingAnnounceChannelId);
  if (!canSendMessages(announceChannel, botMember)) {
    return ["Choose a level-up channel where Blueprint can send rank-up messages."];
  }

  return [];
}

function getLevelingState(settings, channelOptions = []) {
  if (!settings.levelingEnabled) {
    return "disabled";
  }

  if (!settings.levelingAnnounceChannelId) {
    return "incomplete";
  }

  if (
    channelOptions.length > 0 &&
    !channelOptions.some((channel) => channel.id === settings.levelingAnnounceChannelId)
  ) {
    return "incomplete";
  }

  return "live";
}

function getLevelingStatusLabel(state) {
  if (state === "live") {
    return "Live";
  }

  if (state === "incomplete") {
    return "Needs setup";
  }

  return "Disabled";
}

function renderLevelingModuleCard({
  blockerText = "",
  channelOptions,
  defaultOpen = false,
  settings,
}) {
  const state = getLevelingState(settings, channelOptions);
  const channelSelectOptions = [
    `<option value="">Select a channel</option>`,
    ...channelOptions.map((channel) => `
      <option value="${escapeHtml(channel.id)}" ${
        settings.levelingAnnounceChannelId === channel.id ? "selected" : ""
      }>
        ${escapeHtml(channel.label)}
      </option>
    `),
  ].join("");
  const statusHtml = `
    <div class="status-pill status-pill-${state}" data-status-target="leveling">${escapeHtml(getLevelingStatusLabel(state))}</div>
  `;
  const summaryHtml = renderModuleFacts([
    {
      label: "Level-up feed",
      valueHtml: escapeHtml(getChannelLabel(settings.levelingAnnounceChannelId, channelOptions)),
    },
    {
      label: "XP per message",
      valueHtml: escapeHtml(String(settings.levelingXpPerMessage)),
    },
  ]);

  return renderModuleCard({
    bodyHtml: `
      <div class="module-layout">
        <div class="module-fields">
          <div class="field-grid">
            <label>
              <span>Level-up channel</span>
              <select name="levelingAnnounceChannelId">
                ${channelSelectOptions}
              </select>
            </label>

            <label>
              <span>XP per message</span>
              <input
                type="number"
                min="5"
                max="50"
                name="levelingXpPerMessage"
                value="${escapeHtml(String(settings.levelingXpPerMessage))}"
              />
            </label>

            <label>
              <span>XP cooldown (seconds)</span>
              <input
                type="number"
                min="0"
                max="300"
                name="levelingCooldownSeconds"
                value="${escapeHtml(String(settings.levelingCooldownSeconds))}"
              />
            </label>
          </div>

          <label>
            <span>Level-up message</span>
            <input
              name="levelingLevelUpMessage"
              maxlength="180"
              value="${escapeHtml(settings.levelingLevelUpMessage)}"
            />
            <small>Use <code>{mention}</code>, <code>{user}</code>, and <code>{level}</code>.</small>
          </label>
        </div>

        <aside class="preview-card">
          <span class="preview-label">Module summary</span>
          <div class="countdown-preview">${escapeHtml(getLevelingPreview(settings, channelOptions, state))}</div>
          <div class="preview-meta preview-meta-dual">
            <div>
              <span>XP grant</span>
              <strong>${escapeHtml(`${settings.levelingXpPerMessage} XP`)}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>${escapeHtml(getLevelingStatusLabel(state))}</strong>
            </div>
          </div>
          <p class="preview-note">Messages earn XP automatically while cooldown keeps farming under control.</p>
        </aside>
      </div>
    `,
    checked: settings.levelingEnabled,
    blockerHtml: escapeHtml(blockerText),
    defaultOpen,
    descriptionHtml:
      "Reward active members with XP and announce level-ups in one configurable channel.",
    eyebrow: "Leveling",
    inputName: "levelingEnabled",
    moduleKey: "leveling",
    moduleId: "leveling",
    statusHtml,
    summaryHtml,
    theme: "leveling",
    titleHtml: "Message activity leveling",
  });
}

module.exports = {
  defaults,
  getLevelingState,
  getLevelingStatusLabel,
  normalizeLevelingSettings,
  renderLevelingModuleCard,
  validateLevelingSettings,
};

function getLevelingPreview(settings, channelOptions, state) {
  if (state !== "live") {
    return "Leveling stays off until a level-up channel is selected.";
  }

  return `Members gain ${settings.levelingXpPerMessage} XP per message (cooldown ${settings.levelingCooldownSeconds}s). Rank-up alerts post in ${getChannelLabel(settings.levelingAnnounceChannelId, channelOptions)}.`;
}
