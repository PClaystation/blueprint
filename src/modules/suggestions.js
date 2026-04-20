const { escapeHtml, renderModuleCard, renderModuleFacts } = require("../html");
const {
  canSendMessages,
  getChannelLabel,
  normalizeId,
} = require("./common");

const defaults = {
  suggestionsEnabled: false,
  suggestionsChannelId: "",
  suggestionsReviewChannelId: "",
  suggestionsAnonymousAllowed: false,
};

function normalizeSuggestionSettings(input = {}) {
  return {
    suggestionsEnabled: input.suggestionsEnabled === true || input.suggestionsEnabled === "on",
    suggestionsChannelId: normalizeId(input.suggestionsChannelId),
    suggestionsReviewChannelId: normalizeId(input.suggestionsReviewChannelId),
    suggestionsAnonymousAllowed:
      input.suggestionsAnonymousAllowed === true || input.suggestionsAnonymousAllowed === "on",
  };
}

function validateSuggestionSettings(settings, guild, botMember) {
  if (!settings.suggestionsEnabled) {
    return [];
  }

  if (!settings.suggestionsChannelId) {
    return ["Select a public suggestions channel before enabling this module."];
  }

  const publicChannel = guild.channels.cache.get(settings.suggestionsChannelId);
  if (!canSendMessages(publicChannel, botMember)) {
    return ["Choose a suggestions channel where Blueprint can post submitted ideas."];
  }

  if (settings.suggestionsReviewChannelId) {
    const reviewChannel = guild.channels.cache.get(settings.suggestionsReviewChannelId);
    if (!canSendMessages(reviewChannel, botMember)) {
      return ["Choose a review channel where Blueprint can mirror suggestion submissions."];
    }
  }

  return [];
}

function getSuggestionState(settings, channelOptions = []) {
  if (!settings.suggestionsEnabled) {
    return "disabled";
  }

  if (!settings.suggestionsChannelId) {
    return "incomplete";
  }

  if (
    channelOptions.length > 0 &&
    !channelOptions.some((channel) => channel.id === settings.suggestionsChannelId)
  ) {
    return "incomplete";
  }

  if (
    settings.suggestionsReviewChannelId &&
    channelOptions.length > 0 &&
    !channelOptions.some((channel) => channel.id === settings.suggestionsReviewChannelId)
  ) {
    return "incomplete";
  }

  return "live";
}

function getSuggestionStatusLabel(state) {
  if (state === "live") {
    return "Live";
  }

  if (state === "incomplete") {
    return "Needs setup";
  }

  return "Disabled";
}

function renderSuggestionModuleCard({
  blockerText = "",
  channelOptions,
  defaultOpen = false,
  settings,
}) {
  const state = getSuggestionState(settings, channelOptions);
  const channelSelectOptions = [
    `<option value="">Select a channel</option>`,
    ...channelOptions.map((channel) => `
      <option value="${escapeHtml(channel.id)}" ${
        settings.suggestionsChannelId === channel.id ? "selected" : ""
      }>
        ${escapeHtml(channel.label)}
      </option>
    `),
  ].join("");
  const reviewChannelSelectOptions = [
    `<option value="">No review mirror</option>`,
    ...channelOptions.map((channel) => `
      <option value="${escapeHtml(channel.id)}" ${
        settings.suggestionsReviewChannelId === channel.id ? "selected" : ""
      }>
        ${escapeHtml(channel.label)}
      </option>
    `),
  ].join("");
  const statusHtml = `
    <div class="status-pill status-pill-${state}" data-status-target="suggestions">${escapeHtml(getSuggestionStatusLabel(state))}</div>
  `;
  const summaryHtml = renderModuleFacts([
    {
      label: "Public feed",
      valueHtml: escapeHtml(getChannelLabel(settings.suggestionsChannelId, channelOptions)),
    },
    {
      label: "Review queue",
      valueHtml: escapeHtml(getChannelLabel(settings.suggestionsReviewChannelId, channelOptions)),
    },
  ]);

  return renderModuleCard({
    bodyHtml: `
      <div class="module-layout">
        <div class="module-fields">
          <div class="field-grid">
            <label>
              <span>Suggestions channel</span>
              <select name="suggestionsChannelId">
                ${channelSelectOptions}
              </select>
            </label>

            <label>
              <span>Review channel</span>
              <select name="suggestionsReviewChannelId">
                ${reviewChannelSelectOptions}
              </select>
              <small>Optional private mirror for staff context and triage.</small>
            </label>
          </div>

          <div class="subsection">
            <label class="checkbox-chip checkbox-chip-block">
              <input
                type="checkbox"
                name="suggestionsAnonymousAllowed"
                value="on"
                ${settings.suggestionsAnonymousAllowed ? "checked" : ""}
              />
              <span>Allow anonymous submissions through <code>/suggest</code></span>
            </label>
          </div>
        </div>

        <aside class="preview-card">
          <span class="preview-label">Module summary</span>
          <div class="countdown-preview">${escapeHtml(getSuggestionPreview(settings, channelOptions, state))}</div>
          <div class="preview-meta preview-meta-dual">
            <div>
              <span>Public channel</span>
              <strong>${escapeHtml(getChannelLabel(settings.suggestionsChannelId, channelOptions))}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>${escapeHtml(getSuggestionStatusLabel(state))}</strong>
            </div>
          </div>
          <p class="preview-note">Members submit ideas with <code>/suggest</code>; Blueprint numbers each submission automatically.</p>
        </aside>
      </div>
    `,
    checked: settings.suggestionsEnabled,
    blockerHtml: escapeHtml(blockerText),
    defaultOpen,
    descriptionHtml:
      "Collect server ideas in one structured feed, with an optional private mirror for staff review.",
    eyebrow: "Suggestions",
    inputName: "suggestionsEnabled",
    moduleKey: "suggestions",
    moduleId: "suggestions",
    statusHtml,
    summaryHtml,
    theme: "suggestions",
    titleHtml: "Community idea inbox",
  });
}

module.exports = {
  defaults,
  getSuggestionState,
  getSuggestionStatusLabel,
  normalizeSuggestionSettings,
  renderSuggestionModuleCard,
  validateSuggestionSettings,
};

function getSuggestionPreview(settings, channelOptions, state) {
  if (state !== "live") {
    return "Suggestions stay off until a public channel is selected.";
  }

  const anonymousText = settings.suggestionsAnonymousAllowed
    ? " Anonymous suggestions are allowed."
    : " Suggestions always show the submitting member publicly.";

  return `New ideas land in ${getChannelLabel(settings.suggestionsChannelId, channelOptions)}.${anonymousText}`;
}
