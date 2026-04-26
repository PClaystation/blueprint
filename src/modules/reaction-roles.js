const { escapeHtml, renderModuleCard, renderModuleFacts } = require("../html");
const {
  canSendMessages,
  getChannelLabel,
  normalizeId,
  normalizeInteger,
  normalizeText,
} = require("./common");

const defaults = {
  reactionRolesEnabled: false,
  reactionRolesChannelId: "",
  reactionRolesMessageId: "",
  reactionRolesPrompt: "Pick your roles from the reaction menu below.",
  reactionRolesMaxPerMember: 3,
  reactionRolesRemoveOnUnreact: true,
};

function normalizeReactionRoleSettings(input = {}) {
  return {
    reactionRolesEnabled: input.reactionRolesEnabled === true || input.reactionRolesEnabled === "on",
    reactionRolesChannelId: normalizeId(input.reactionRolesChannelId),
    reactionRolesMessageId: normalizeId(input.reactionRolesMessageId),
    reactionRolesPrompt: normalizeText(input.reactionRolesPrompt, defaults.reactionRolesPrompt, 180),
    reactionRolesMaxPerMember: normalizeInteger(input.reactionRolesMaxPerMember, 3, 1, 25),
    reactionRolesRemoveOnUnreact:
      input.reactionRolesRemoveOnUnreact === true || input.reactionRolesRemoveOnUnreact === "on",
  };
}

function validateReactionRoleSettings(settings, guild, botMember) {
  if (!settings.reactionRolesEnabled) {
    return [];
  }

  if (!settings.reactionRolesChannelId) {
    return ["Select a reaction role channel before enabling this module."];
  }

  const targetChannel = guild.channels.cache.get(settings.reactionRolesChannelId);
  if (!canSendMessages(targetChannel, botMember)) {
    return ["Choose a channel where Blueprint can post the reaction-role panel."];
  }

  if (!settings.reactionRolesMessageId) {
    return ["Paste the setup message ID used for the reaction-role panel."];
  }

  return [];
}

function getReactionRoleState(settings, channelOptions = []) {
  if (!settings.reactionRolesEnabled) {
    return "disabled";
  }

  if (!settings.reactionRolesChannelId || !settings.reactionRolesMessageId) {
    return "incomplete";
  }

  if (
    channelOptions.length > 0 &&
    !channelOptions.some((channel) => channel.id === settings.reactionRolesChannelId)
  ) {
    return "incomplete";
  }

  return "live";
}

function getReactionRoleStatusLabel(state) {
  if (state === "live") {
    return "Live";
  }

  if (state === "incomplete") {
    return "Needs setup";
  }

  return "Disabled";
}

function renderReactionRoleModuleCard({
  blockerText = "",
  channelOptions,
  defaultOpen = false,
  settings,
}) {
  const state = getReactionRoleState(settings, channelOptions);
  const channelSelectOptions = [
    `<option value="">Select a channel</option>`,
    ...channelOptions.map((channel) => `
      <option value="${escapeHtml(channel.id)}" ${
        settings.reactionRolesChannelId === channel.id ? "selected" : ""
      }>
        ${escapeHtml(channel.label)}
      </option>
    `),
  ].join("");
  const statusHtml = `
    <div class="status-pill status-pill-${state}" data-status-target="reactionRoles">${escapeHtml(getReactionRoleStatusLabel(state))}</div>
  `;
  const summaryHtml = renderModuleFacts([
    {
      label: "Panel channel",
      valueHtml: escapeHtml(getChannelLabel(settings.reactionRolesChannelId, channelOptions)),
    },
    {
      label: "Role cap",
      valueHtml: escapeHtml(String(settings.reactionRolesMaxPerMember)),
    },
  ]);

  return renderModuleCard({
    bodyHtml: `
      <div class="module-layout">
        <div class="module-fields">
          <div class="field-grid">
            <label>
              <span>Reaction panel channel</span>
              <select name="reactionRolesChannelId">
                ${channelSelectOptions}
              </select>
            </label>

            <label>
              <span>Max roles per member</span>
              <input
                type="number"
                min="1"
                max="25"
                name="reactionRolesMaxPerMember"
                value="${escapeHtml(String(settings.reactionRolesMaxPerMember))}"
              />
            </label>

            <label>
              <span>Setup message ID</span>
              <input
                type="text"
                name="reactionRolesMessageId"
                maxlength="20"
                value="${escapeHtml(settings.reactionRolesMessageId)}"
                placeholder="123456789012345678"
              />
            </label>
          </div>

          <label>
            <span>Panel prompt</span>
            <input
              name="reactionRolesPrompt"
              maxlength="180"
              value="${escapeHtml(settings.reactionRolesPrompt)}"
            />
          </label>

          <div class="subsection">
            <label class="checkbox-chip checkbox-chip-block">
              <input
                type="checkbox"
                name="reactionRolesRemoveOnUnreact"
                value="on"
                ${settings.reactionRolesRemoveOnUnreact ? "checked" : ""}
              />
              <span>Remove role if the member removes the reaction</span>
            </label>
          </div>
        </div>

        <aside class="preview-card">
          <span class="preview-label">Module summary</span>
          <div class="countdown-preview">${escapeHtml(getReactionRolePreview(settings, channelOptions, state))}</div>
          <div class="preview-meta preview-meta-dual">
            <div>
              <span>Status</span>
              <strong>${escapeHtml(getReactionRoleStatusLabel(state))}</strong>
            </div>
            <div>
              <span>Setup message</span>
              <strong>${escapeHtml(settings.reactionRolesMessageId || "Generated from panel")}</strong>
            </div>
          </div>
          <p class="preview-note">Use this for self-assignable pronoun, game, or notification roles without staff intervention.</p>
        </aside>
      </div>
    `,
    checked: settings.reactionRolesEnabled,
    blockerHtml: escapeHtml(blockerText),
    defaultOpen,
    descriptionHtml:
      "Give members self-assignable roles from a configurable panel with selection limits.",
    eyebrow: "Reaction roles",
    inputName: "reactionRolesEnabled",
    moduleKey: "reactionRoles",
    moduleId: "reaction-roles",
    statusHtml,
    summaryHtml,
    theme: "suggestions",
    titleHtml: "Self-assign role panel",
  });
}

module.exports = {
  defaults,
  getReactionRoleState,
  getReactionRoleStatusLabel,
  normalizeReactionRoleSettings,
  renderReactionRoleModuleCard,
  validateReactionRoleSettings,
};

function getReactionRolePreview(settings, channelOptions, state) {
  if (state !== "live") {
    return "Reaction roles stay off until a panel channel and setup message are selected.";
  }

  const removeText = settings.reactionRolesRemoveOnUnreact
    ? "Roles are removed when reactions are removed."
    : "Roles remain even after removing reactions.";
  const messageText = settings.reactionRolesMessageId
    ? ` Existing setup message: ${settings.reactionRolesMessageId}.`
    : "";

  return `Blueprint posts the role panel in ${getChannelLabel(settings.reactionRolesChannelId, channelOptions)} with a maximum of ${settings.reactionRolesMaxPerMember} role picks per member. ${removeText}${messageText}`;
}
