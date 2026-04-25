const { escapeHtml, renderModuleCard, renderModuleFacts } = require("../html");
const {
  canSendMessages,
  getChannelLabel,
  normalizeId,
  normalizeInteger,
} = require("./common");

const STARBOARD_EMOJI = "⭐";

const defaults = {
  starboardEnabled: false,
  starboardChannelId: "",
  starboardThreshold: 3,
  starboardAllowSelfStar: false,
};

function normalizeStarboardSettings(input = {}) {
  return {
    starboardEnabled: input.starboardEnabled === true || input.starboardEnabled === "on",
    starboardChannelId: normalizeId(input.starboardChannelId),
    starboardThreshold: normalizeInteger(input.starboardThreshold, 3, 2, 25),
    starboardAllowSelfStar:
      input.starboardAllowSelfStar === true || input.starboardAllowSelfStar === "on",
  };
}

function validateStarboardSettings(settings, guild, botMember) {
  if (!settings.starboardEnabled) {
    return [];
  }

  if (!settings.starboardChannelId) {
    return ["Select a highlight channel before enabling this module."];
  }

  const channel = guild.channels.cache.get(settings.starboardChannelId);
  if (!canSendMessages(channel, botMember)) {
    return ["Choose a highlight channel where Blueprint can publish featured posts."];
  }

  return [];
}

function getStarboardState(settings, channelOptions = []) {
  if (!settings.starboardEnabled) {
    return "disabled";
  }

  if (!settings.starboardChannelId) {
    return "incomplete";
  }

  if (
    channelOptions.length > 0 &&
    !channelOptions.some((channel) => channel.id === settings.starboardChannelId)
  ) {
    return "incomplete";
  }

  return "live";
}

function getStarboardStatusLabel(state) {
  if (state === "live") {
    return "Live";
  }

  if (state === "incomplete") {
    return "Needs setup";
  }

  return "Disabled";
}

function renderStarboardModuleCard({
  blockerText = "",
  channelOptions,
  defaultOpen = false,
  settings,
}) {
  const state = getStarboardState(settings, channelOptions);
  const channelSelectOptions = [
    `<option value="">Select a channel</option>`,
    ...channelOptions.map((channel) => `
      <option value="${escapeHtml(channel.id)}" ${
        settings.starboardChannelId === channel.id ? "selected" : ""
      }>
        ${escapeHtml(channel.label)}
      </option>
    `),
  ].join("");
  const statusHtml = `
    <div class="status-pill status-pill-${state}" data-status-target="starboard">${escapeHtml(getStarboardStatusLabel(state))}</div>
  `;
  const summaryHtml = renderModuleFacts([
    {
      label: "Destination",
      valueHtml: escapeHtml(getChannelLabel(settings.starboardChannelId, channelOptions)),
    },
    {
      label: "Threshold",
      valueHtml: escapeHtml(`${settings.starboardThreshold} ${STARBOARD_EMOJI}`),
    },
  ]);

  return renderModuleCard({
    bodyHtml: `
      <div class="module-layout">
        <div class="module-fields">
          <div class="field-grid">
            <label>
              <span>Highlight channel</span>
              <select name="starboardChannelId">
                ${channelSelectOptions}
              </select>
              <small>Featured posts are mirrored here after they reach the threshold.</small>
            </label>

            <label>
              <span>Star threshold</span>
              <input
                type="number"
                min="2"
                max="25"
                name="starboardThreshold"
                value="${escapeHtml(String(settings.starboardThreshold))}"
              />
              <small>How many <code>${STARBOARD_EMOJI}</code> reactions a post needs before it is highlighted.</small>
            </label>
          </div>

          <div class="subsection">
            <span class="subsection-label">Eligibility</span>
            <label class="checkbox-chip checkbox-chip-block">
              <input
                type="checkbox"
                name="starboardAllowSelfStar"
                value="on"
                ${settings.starboardAllowSelfStar ? "checked" : ""}
              />
              <span>Count self-stars from the message author</span>
            </label>
          </div>
        </div>

        <aside class="preview-card">
          <span class="preview-label">Module summary</span>
          <div class="countdown-preview">${escapeHtml(getStarboardPreview(settings, channelOptions, state))}</div>
          <div class="preview-meta preview-meta-dual">
            <div>
              <span>Threshold</span>
              <strong>${escapeHtml(`${settings.starboardThreshold} ${STARBOARD_EMOJI}`)}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>${escapeHtml(getStarboardStatusLabel(state))}</strong>
            </div>
          </div>
          <p class="preview-note">Members highlight standout posts with <code>${STARBOARD_EMOJI}</code>; Blueprint keeps the board updated automatically.</p>
        </aside>
      </div>
    `,
    checked: settings.starboardEnabled,
    blockerHtml: escapeHtml(blockerText),
    defaultOpen,
    descriptionHtml:
      "Mirror the server's best messages into one curated highlights feed once they earn enough stars.",
    eyebrow: "Highlights",
    inputName: "starboardEnabled",
    moduleKey: "starboard",
    moduleId: "starboard",
    statusHtml,
    summaryHtml,
    theme: "starboard",
    titleHtml: "Reaction highlight board",
  });
}

async function getStarboardReactionCount(
  reaction,
  { allowSelfStar = false, authorId = "" } = {},
) {
  const users = await reaction.users.fetch();

  return users.filter(
    (user) => !user.bot && (allowSelfStar || user.id !== authorId),
  ).size;
}

function isStarboardReaction(emoji) {
  return emoji?.name === STARBOARD_EMOJI;
}

function buildStarboardPostContent({ message, starCount }) {
  const summaryLine = `${STARBOARD_EMOJI} **${starCount}** in <#${message.channelId}> by <@${message.author.id}>`;
  const bodyLine = formatStarboardBody(message);
  const attachmentUrl = getRenderableAttachmentUrl(message);
  const lines = [summaryLine, bodyLine, message.url];

  if (attachmentUrl) {
    lines.push(attachmentUrl);
  }

  return lines.join("\n");
}

module.exports = {
  STARBOARD_EMOJI,
  buildStarboardPostContent,
  defaults,
  getStarboardReactionCount,
  getStarboardState,
  getStarboardStatusLabel,
  isStarboardReaction,
  normalizeStarboardSettings,
  renderStarboardModuleCard,
  validateStarboardSettings,
};

function getStarboardPreview(settings, channelOptions, state) {
  if (state !== "live") {
    return "Highlights stay off until a destination channel is selected.";
  }

  const selfStarRule = settings.starboardAllowSelfStar
    ? " Self-stars are counted."
    : " Self-stars are ignored.";

  return `Posts that reach ${settings.starboardThreshold} ${STARBOARD_EMOJI} reactions are mirrored into ${getChannelLabel(
    settings.starboardChannelId,
    channelOptions,
  )}.${selfStarRule}`;
}

function formatStarboardBody(message) {
  const excerpt = String(message.content || "").trim().replace(/\s+/g, " ");

  if (excerpt) {
    const clipped = excerpt.length > 280 ? `${excerpt.slice(0, 277)}...` : excerpt;
    return `> ${clipped}`;
  }

  if (message.attachments?.size) {
    return "> [Attachment only]";
  }

  return "> [No text content]";
}

function getRenderableAttachmentUrl(message) {
  const attachments = Array.from(message.attachments?.values?.() || []);
  const renderableAttachment = attachments.find((attachment) =>
    String(attachment.contentType || "").startsWith("image/"),
  );

  return renderableAttachment?.url || attachments[0]?.url || "";
}
