function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderFeatureToggle({
  checked,
  descriptionHtml,
  disabledLabel = "Disabled",
  enabledLabel = "Enabled",
  inputName,
  kindLabel,
  titleHtml,
}) {
  return `
    <label class="feature-toggle-card">
      <input
        type="checkbox"
        name="${escapeHtml(inputName)}"
        value="on"
        ${checked ? "checked" : ""}
      />
      <span class="feature-toggle-surface">
        <span class="feature-toggle-copy">
          <span class="feature-toggle-kicker">${escapeHtml(kindLabel)}</span>
          <span class="feature-toggle-title">${titleHtml}</span>
          <span class="feature-toggle-description">${descriptionHtml}</span>
        </span>
        <span class="feature-toggle-action" aria-hidden="true">
          <span class="feature-toggle-state feature-toggle-state-enabled">
            ${escapeHtml(enabledLabel)}
          </span>
          <span class="feature-toggle-state feature-toggle-state-disabled">
            ${escapeHtml(disabledLabel)}
          </span>
          <span class="feature-toggle-switch">
            <span class="feature-toggle-switch-knob"></span>
          </span>
        </span>
      </span>
    </label>
  `;
}

module.exports = {
  escapeHtml,
  renderFeatureToggle,
};
