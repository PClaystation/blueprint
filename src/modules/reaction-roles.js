const { escapeHtml, renderModuleCard, renderModuleFacts } = require("../html");
const { getChannelLabel, normalizeId, normalizeInteger } = require("./common");

const defaults = {
  reactionRolesEnabled: false,
  reactionRolesChannelId: "",
  reactionRolesMessageId: "",
  reactionRolesMaxPerMember: 1,
  reactionRolesRemoveOnUnreact: true,
};

function normalizeReactionRoleSettings(input = {}) {
  return {
    reactionRolesEnabled:
      input.reactionRolesEnabled === true || input.reactionRolesEnabled === "on",
    reactionRolesChannelId: normalizeId(input.reactionRolesChannelId),
    reactionRolesMessageId: normalizeId(input.reactionRolesMessageId),
    reactionRolesMaxPerMember: normalizeInteger(input.reactionRolesMaxPerMember, 1, 1, 25),
    reactionRolesRemoveOnUnreact:
      input.reactionRolesRemoveOnUnreact === true || input.reactionRolesRemoveOnUnreact === "on",
  };
}

function validateReactionRoleSettings(settings, guild) {
  if (!settings.reactionRolesEnabled) {
    return [];
  }

  if (!settings.reactionRolesChannelId) {
    return ["Choose a reaction roles channel before enabling this module."];
  }

  if (!guild.channels.cache.has(settings.reactionRolesChannelId)) {
    return ["Choose a valid reaction roles channel in this server."];
  }

  if (!settings.reactionRolesMessageId) {
    return ["Paste the setup message ID used for role reactions."];
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
      label: "Channel",
      valueHtml: escapeHtml(getChannelLabel(settings.reactionRolesChannelId, channelOptions)),
    },
    {
      label: "Max roles",
      valueHtml: escapeHtml(String(settings.reactionRolesMaxPerMember)),
    },
  ]);

  return renderModuleCard({
    bodyHtml: `
      <div class="module-layout">
        <div class="module-fields">
          <div class="field-grid">
            <label>
              <span>Reaction role channel</span>
              <select name="reactionRolesChannelId">
                ${channelSelectOptions}
              </select>
            </label>

            <label>
              <span>Reaction setup message ID</span>
              <input
                type="text"
                name="reactionRolesMessageId"
                maxlength="20"
                value="${escapeHtml(settings.reactionRolesMessageId)}"
                placeholder="123456789012345678"
              />
            </label>

            <label>
              <span>Max selectable roles per member</span>
              <input
                type="number"
                min="1"
                max="25"
                name="reactionRolesMaxPerMember"
                value="${escapeHtml(String(settings.reactionRolesMaxPerMember))}"
              />
            </label>
          </div>

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
              <span>Message ID</span>
              <strong>${escapeHtml(settings.reactionRolesMessageId || "Not set")}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>${escapeHtml(getReactionRoleStatusLabel(state))}</strong>
            </div>
          </div>
        </aside>
      </div>
    `,
    checked: settings.reactionRolesEnabled,
    blockerHtml: escapeHtml(blockerText),
    defaultOpen,
    descriptionHtml: "Let members self-assign roles from a configured reaction message.",
    eyebrow: "Reaction roles",
    inputName: "reactionRolesEnabled",
    moduleKey: "reactionRoles",
    moduleId: "reaction-roles",
    statusHtml,
    summaryHtml,
    theme: "tickets",
    titleHtml: "Self-assign role menus",
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
    return "Reaction roles stay off until a channel and message ID are configured.";
  }

  const removeText = settings.reactionRolesRemoveOnUnreact
    ? "Roles are removed when reactions are removed."
    : "Roles remain even after removing reactions.";

  return `Members can pick up to ${settings.reactionRolesMaxPerMember} role(s) in ${getChannelLabel(settings.reactionRolesChannelId, channelOptions)}. ${removeText}`;
}
