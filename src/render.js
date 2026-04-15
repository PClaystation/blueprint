const {
  COMMON_DAILY_ALERT_TIME_ZONES,
  DEFAULT_DAILY_ALERT_TIME_ZONE,
  getCountdownAlertStatusLabel,
  getCountdownAlertSummary,
  SUPPORTED_DAILY_ALERT_TIME_ZONES,
  WEEKDAY_OPTIONS,
  excludedDatesToTextarea,
  formatDateLabel,
  getCountdownResult,
} = require("./countdown");
const {
  escapeHtml,
  renderFeatureToggle,
  renderModuleCard,
  renderModuleFacts,
} = require("./html");
const { renderAutoRoleModuleCard } = require("./modules/auto-role");
const { renderWelcomeModuleCard } = require("./modules/welcome");

function renderLayout({
  authConfig,
  body,
  sessionUser,
  title,
}) {
  const fallbackAvatar = "/images/C2-new-white.png";
  const authButton = sessionUser
    ? `<a class="button button-ghost" href="/logout">Log out</a>`
    : `<button class="button button-ghost" id="login-button" type="button">Log in</button>`;

  const authMeta = sessionUser
    ? `<div class="user-chip">
        ${
          sessionUser.avatarUrl
            ? `<img src="${escapeHtml(sessionUser.avatarUrl)}" alt="" onerror="this.onerror=null;this.src='${fallbackAvatar}'" />`
            : `<img src="${fallbackAvatar}" alt="" />`
        }
        <span>${escapeHtml(sessionUser.username)}</span>
      </div>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0f172a" />
    <title>${escapeHtml(title)}</title>
    <link rel="shortcut icon" href="/favicon.ico" />
    <link rel="icon" type="image/png" href="/images/blueprint-pfp2.png" />
    <link rel="apple-touch-icon" href="/images/blueprint-pfp2.png" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div class="page-shell">
      <header class="topbar">
        <div class="topbar-branding">
          <a class="brand" href="/">
            <span class="brand-lockup">
              <span class="brand-mark">
                <img src="/images/blueprint-pfp2.png" alt="Blueprint" />
              </span>
              <span class="brand-copy">
                <span class="brand-title">Blueprint</span>
                <span class="brand-subtitle">Control Center</span>
              </span>
            </span>
          </a>
          <div class="maker-badge" aria-label="Made by Continental">
            <span class="maker-badge-label">Made by</span>
            <img src="/images/Continental-nobg-white.png" alt="Continental" />
          </div>
        </div>
        <div class="topbar-actions">
          ${authMeta}
          ${authButton}
        </div>
      </header>
      ${body}
    </div>
    <script>
      window.BLUEPRINT_AUTH = ${JSON.stringify(authConfig)};
    </script>
    <script src="/app.js"></script>
  </body>
</html>`;
}

function renderHome({ authConfig, sessionUser }) {
  const primaryAction = sessionUser
    ? `<a class="button" href="/dashboard">Open dashboard</a>`
    : `<button class="button" id="login-button" type="button">Sign in with Continental ID</button>`;

  const body = `
    <main class="hero">
      <section class="hero-copy">
        <p class="eyebrow">Shared bot control center</p>
        <h1>Use Continental ID, then manage servers through the Discord account linked to it.</h1>
        <p class="lede">
          This app signs users in with the Dashboard auth system, reads the Discord account
          linked to that identity, and lets moderators configure the bot only in servers where
          the bot is installed and that linked Discord account has management rights.
        </p>
        <div class="hero-actions">
          ${primaryAction}
        </div>
      </section>
      <section class="panel brand-panel">
        <div class="brand-panel-header">
          <img
            class="brand-panel-banner"
            src="/images/Blueprint-banner.png"
            alt="Blueprint"
          />
          <div class="brand-panel-signature">
            <img src="/images/C2-new-white.png" alt="" aria-hidden="true" />
            <span>Built by Continental</span>
          </div>
        </div>
        <p class="brand-panel-copy">
          Blueprint is Continental’s dashboard-first Discord control center: modular,
          polished, and designed to stay out of the way until you need it.
        </p>
        <h2>How access works</h2>
        <ul class="feature-list">
          <li>Login uses Continental ID, not a separate site account</li>
          <li>The linked Discord identity decides which installed servers you can manage</li>
          <li>Server settings stay centralized in SQLite for the shared bot</li>
          <li>The bot reads those settings immediately for slash commands</li>
        </ul>
      </section>
    </main>
  `;

  return renderLayout({
    authConfig,
    body,
    sessionUser,
    title: "Blueprint Control Center",
  });
}

function renderDashboard({
  addBotUrl,
  authConfig,
  discordLinked,
  guilds,
  sessionUser,
}) {
  const attentionServers = guilds.filter((guild) => guild.attentionCount > 0).length;
  const cards = guilds
    .map((guild) => {
      const icon = guild.iconUrl
        ? `<img class="server-avatar-image" src="${escapeHtml(guild.iconUrl)}" alt="" />`
        : escapeHtml(guild.name.slice(0, 2).toUpperCase());
      const summaryHtml = renderModuleFacts([
        {
          label: "Enabled",
          valueHtml: String(guild.enabledCount),
        },
        {
          label: "Needs setup",
          valueHtml: String(guild.attentionCount),
        },
      ]);

      return `
        <article
          class="server-card ${guild.attentionCount > 0 ? "server-card-alert" : ""}"
          data-guild-card
          data-guild-attention="${guild.attentionCount > 0 ? "true" : "false"}"
          data-guild-name="${escapeHtml(guild.name.toLowerCase())}"
        >
          <div class="server-card-meta-row">
            <span class="status-pill status-pill-${escapeHtml(guild.statusTone)}">
              ${escapeHtml(guild.statusLabel)}
            </span>
            <span class="server-card-timestamp">Updated ${escapeHtml(guild.updatedAtLabel)}</span>
          </div>
          <div class="server-card-head">
            <div class="server-avatar">${icon}</div>
            <div>
              <h2>${escapeHtml(guild.name)}</h2>
              <p>Installed and manageable by your linked Discord account</p>
            </div>
          </div>
          ${summaryHtml}
          <a class="button" href="/dashboard/${guild.id}">Manage</a>
        </article>
      `;
    })
    .join("");

  const discordNotice = discordLinked
    ? ""
    : `
      <div class="notice">
        <strong>Discord account not linked.</strong>
        <p>
          Link Discord on your Continental ID account first, then this dashboard can match
          you against the servers where the bot is installed.
        </p>
        <div class="notice-actions">
          <button class="button" id="connect-discord-button" type="button">Link Discord</button>
        </div>
      </div>
    `;

  const emptyState = discordLinked
    ? "No manageable installed servers were found for your linked Discord account."
    : "Link your Discord account to load manageable servers.";

  const body = `
    <main class="dashboard-page">
      <section class="section-header">
        <div>
          <p class="eyebrow">Installed servers</p>
          <h1>Choose a server</h1>
        </div>
        <a class="button button-ghost" href="${addBotUrl}">Add bot to a server</a>
      </section>
      <section class="dashboard-toolbar ${guilds.length ? "" : "is-hidden"}">
        <label class="search-field">
          <span class="search-field-label">Search servers</span>
          <input
            type="search"
            placeholder="Search by server name"
            data-guild-search
          />
        </label>
        <div class="dashboard-toolbar-actions">
          <label class="checkbox-chip">
            <input type="checkbox" data-guild-attention-filter />
            <span>Show attention only</span>
          </label>
          <div class="dashboard-summary">
            <span class="dashboard-summary-pill">${guilds.length} servers</span>
            <span class="dashboard-summary-pill">${attentionServers} need setup</span>
          </div>
        </div>
      </section>
      ${discordNotice}
      <section class="server-grid">
        ${cards || `<div class="empty-state">${escapeHtml(emptyState)}</div>`}
      </section>
      <div class="empty-state is-hidden" data-guild-search-empty>
        No servers match the current search and filter.
      </div>
    </main>
  `;

  return renderLayout({
    authConfig,
    body,
    sessionUser,
    title: "Server Dashboard",
  });
}

function renderGuildSettings({
  authConfig,
  channelOptions,
  errorMessage,
  guild,
  pageMeta,
  roleOptions,
  saveMessage,
  sessionUser,
  settings,
}) {
  const countdown = getCountdownResult(settings);
  const countdownAlert = getCountdownAlertSummary(settings, channelOptions);
  const selectedWeekdays = new Set(settings.countdownWeekdays || []);
  const hasSavedCountdown = Boolean(
    settings.countdownEnabled ||
    settings.countdownTitle ||
    settings.countdownTargetDate ||
    excludedDatesToTextarea(settings.countdownExcludedDates) ||
    settings.countdownAlertEnabled ||
    settings.countdownAlertChannelId ||
    settings.countdownAlertTimeZone !== DEFAULT_DAILY_ALERT_TIME_ZONE,
  );
  const countdownPreview = escapeHtml(countdown.commandPreview).replaceAll("\n", "<br />");
  const countdownAlertPreview = escapeHtml(countdownAlert.preview).replaceAll("\n", "<br />");
  const countdownAlertStatusClass = `status-pill status-pill-${countdownAlert.state}`;
  const excludedDateChips = countdown.excludedDates
    .map((isoDate) => `
      <button
        class="date-chip"
        type="button"
        data-excluded-date-chip
        data-iso-date="${escapeHtml(isoDate)}"
      >
        <span>${escapeHtml(formatExcludedDateChipLabel(isoDate))}</span>
        <span aria-hidden="true">Remove</span>
      </button>
    `)
    .join("");
  const countdownAlertTimeZoneOptions = renderCountdownAlertTimeZoneOptions(
    settings.countdownAlertTimeZone,
  );
  const countdownSummaryHtml = renderModuleFacts([
    {
      label: "Event",
      valueHtml: escapeHtml(countdown.title || "Not set"),
    },
    {
      label: "Target",
      valueHtml: escapeHtml(countdown.targetDateLabel || "Not set"),
    },
    {
      label: "Alerts",
      valueHtml: escapeHtml(getCountdownAlertStatusLabel(countdownAlert.state)),
    },
  ]);
  const weekdayCheckboxes = WEEKDAY_OPTIONS.map((weekday) => `
    <label class="weekday-pill">
      <input
        type="checkbox"
        name="countdownWeekdays"
        value="${weekday.value}"
        ${selectedWeekdays.has(weekday.value) ? "checked" : ""}
      />
      <span>${weekday.shortLabel}</span>
    </label>
  `).join("");
  const countdownChannelOptions = [
    `<option value="">Select a channel</option>`,
    ...channelOptions.map((channel) => `
      <option value="${escapeHtml(channel.id)}" ${
        settings.countdownAlertChannelId === channel.id ? "selected" : ""
      }>
        ${escapeHtml(channel.label)}
      </option>
    `),
  ].join("");
  const validationItems = [
    pageMeta?.moduleBlockers?.countdown
      ? `<li><strong>Countdown:</strong> ${escapeHtml(pageMeta.moduleBlockers.countdown)}</li>`
      : "",
    pageMeta?.moduleBlockers?.welcome
      ? `<li><strong>Welcome:</strong> ${escapeHtml(pageMeta.moduleBlockers.welcome)}</li>`
      : "",
    pageMeta?.moduleBlockers?.autoRole
      ? `<li><strong>Auto role:</strong> ${escapeHtml(pageMeta.moduleBlockers.autoRole)}</li>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const body = `
    <main class="settings-page">
      <section class="section-header">
        <div>
          <p class="eyebrow">Server settings</p>
          <h1>${escapeHtml(guild.name)}</h1>
        </div>
        <a class="button button-ghost" href="/dashboard">Back</a>
      </section>

      <section class="overview-grid">
        <article class="overview-card">
          <span class="overview-label">Enabled modules</span>
          <strong class="overview-value" data-overview-enabled>${escapeHtml(String(pageMeta?.enabledModules || 0))}</strong>
          <p class="overview-copy">Countdown, welcome, and auto role are counted here.</p>
        </article>
        <article class="overview-card ${pageMeta?.attentionModules ? "overview-card-alert" : ""}">
          <span class="overview-label">Needs setup</span>
          <strong class="overview-value" data-overview-attention>${escapeHtml(String(pageMeta?.attentionModules || 0))}</strong>
          <p class="overview-copy">Enabled modules with missing or invalid config.</p>
        </article>
        <article class="overview-card">
          <span class="overview-label">Hello command</span>
          <strong class="overview-value" data-overview-hello>${pageMeta?.helloEnabled ? "Live" : "Disabled"}</strong>
          <p class="overview-copy">Core reply access in this server.</p>
        </article>
        <article class="overview-card">
          <span class="overview-label">Last updated</span>
          <strong class="overview-value overview-value-small" data-overview-updated>${escapeHtml(pageMeta?.lastUpdatedLabel || "Not saved yet")}</strong>
          <p class="overview-copy">Most recent saved dashboard change.</p>
        </article>
      </section>

      ${saveMessage ? `<div class="notice">${escapeHtml(saveMessage)}</div>` : ""}
      ${errorMessage ? `<div class="notice notice-error">${escapeHtml(errorMessage)}</div>` : ""}
      <section class="notice notice-warning ${validationItems ? "" : "is-hidden"}" data-validation-summary>
        <strong>Modules needing attention</strong>
        <ul class="validation-list" data-validation-list>
          ${validationItems}
        </ul>
      </section>

      <form class="settings-stack" method="post" action="/dashboard/${guild.id}" data-settings-form>
        <section class="settings-card">
          <div class="card-header">
            <div>
              <p class="eyebrow">Core commands</p>
              <h2>Reply settings</h2>
              <p class="card-copy">
                Adjust the built-in slash commands and keep the dashboard-owned replies consistent.
              </p>
            </div>
          </div>

          ${renderFeatureToggle({
            checked: settings.helloEnabled,
            descriptionHtml:
              "Make <code>/hello</code> available in this server, or turn it off completely when you do not want the command exposed.",
            disabledLabel: "Command off",
            enabledLabel: "Command on",
            inputName: "helloEnabled",
            kindLabel: "Command status",
            titleHtml: "<code>/hello</code> access",
          })}

          <div class="field-grid">
            <label>
              <span>Ping response</span>
              <input
                name="pingResponse"
                maxlength="120"
                value="${escapeHtml(settings.pingResponse)}"
                required
              />
            </label>

            <label>
              <span>Hello template</span>
              <input
                name="helloTemplate"
                maxlength="160"
                value="${escapeHtml(settings.helloTemplate)}"
                required
              />
              <small>Use <code>{user}</code> and <code>{server}</code>.</small>
            </label>

            <label>
              <span>Accent color</span>
              <input
                type="color"
                name="accentColor"
                value="${escapeHtml(settings.accentColor)}"
              />
            </label>
          </div>
        </section>

        ${renderModuleCard({
          bodyHtml: `
            <div class="countdown-layout">
              <div class="countdown-fields">
                <div class="field-grid">
                  <label>
                    <span>Event name</span>
                    <input
                      name="countdownTitle"
                      maxlength="80"
                      placeholder="Summer break, launch day, finals week..."
                      value="${escapeHtml(settings.countdownTitle)}"
                    />
                  </label>

                  <label>
                    <span>Target date</span>
                    <input
                      type="date"
                      name="countdownTargetDate"
                      value="${escapeHtml(settings.countdownTargetDate)}"
                    />
                  </label>

                  <label>
                    <span>Counting mode</span>
                    <select name="countdownMode" data-countdown-mode>
                      <option value="calendar" ${settings.countdownMode === "calendar" ? "selected" : ""}>
                        Calendar days
                      </option>
                      <option value="active-days" ${settings.countdownMode === "active-days" ? "selected" : ""}>
                        Selected weekdays only
                      </option>
                    </select>
                    <small data-countdown-mode-copy>
                      ${escapeHtml(getCountdownModeCopy(settings.countdownMode))}
                    </small>
                  </label>
                </div>

                <div
                  class="countdown-schedule-fields ${settings.countdownMode === "active-days" ? "" : "is-hidden"}"
                  data-countdown-schedule-fields
                >
                  <div class="subsection">
                    <span class="subsection-label">Count these weekdays</span>
                    <div class="weekday-grid">
                      ${weekdayCheckboxes}
                    </div>
                  </div>

                  <div class="subsection">
                    <div class="card-header">
                      <div>
                        <span class="subsection-label">Excluded dates</span>
                        <p class="card-copy">
                          Remove holidays, breaks, and other off-days from selected weekday countdowns.
                        </p>
                      </div>
                    </div>

                    <div class="excluded-dates-panel">
                      <input
                        type="hidden"
                        name="countdownExcludedDates"
                        value="${escapeHtml(countdown.excludedDates.join(","))}"
                        data-excluded-dates-hidden
                      />

                      <div class="excluded-dates-input-row">
                        <label class="excluded-date-picker">
                          <span>Add excluded date</span>
                          <input type="date" data-excluded-date-input />
                        </label>
                        <button
                          class="button button-ghost button-small"
                          type="button"
                          data-excluded-date-add
                        >
                          Add date
                        </button>
                      </div>

                      <div
                        class="excluded-date-chip-list ${excludedDateChips ? "" : "is-hidden"}"
                        data-excluded-date-list
                      >
                        ${excludedDateChips}
                      </div>

                      <p
                        class="preview-note ${excludedDateChips ? "is-hidden" : ""}"
                        data-excluded-date-empty
                      >
                        No excluded dates selected yet.
                      </p>

                      <small>
                        Excluded dates only reduce the countdown when they fall on a selected weekday
                        after today and before the target date.
                      </small>
                    </div>
                  </div>
                </div>

                <div class="subsection">
                  <div class="card-header card-header-spread subsection-header">
                    <div>
                      <span class="subsection-label">Daily alerts</span>
                      <p class="card-copy">
                        Post one countdown update per day in a chosen channel at a local server time.
                      </p>
                    </div>
                    <div class="${countdownAlertStatusClass}" data-countdown-alert-status>
                      ${escapeHtml(getCountdownAlertStatusLabel(countdownAlert.state))}
                    </div>
                  </div>

                  ${renderFeatureToggle({
                    checked: settings.countdownAlertEnabled,
                    descriptionHtml:
                      "Enable one daily countdown post for this server. Blueprint sends it once per day after the chosen time until the target date arrives.",
                    disabledLabel: "Alerts off",
                    enabledLabel: "Alerts on",
                    inputName: "countdownAlertEnabled",
                    kindLabel: "Delivery",
                    titleHtml: "Daily countdown alerts",
                  })}

                  <div
                    class="field-grid countdown-alert-fields ${settings.countdownAlertEnabled ? "" : "is-hidden"}"
                    data-countdown-alert-fields
                  >
                    <label>
                      <span>Alert channel</span>
                      <select name="countdownAlertChannelId">
                        ${countdownChannelOptions}
                      </select>
                    </label>

                    <label>
                      <span>Alert time zone</span>
                      <select name="countdownAlertTimeZone">
                        ${countdownAlertTimeZoneOptions}
                      </select>
                      <small>Schedule alerts in the server's local time zone.</small>
                    </label>

                    <label>
                      <span>Send time</span>
                      <input
                        type="time"
                        name="countdownAlertTime"
                        value="${escapeHtml(settings.countdownAlertTime)}"
                      />
                      <small data-countdown-alert-time-copy>${escapeHtml(countdownAlert.timeHelpText)}</small>
                    </label>
                  </div>
                </div>

                <div class="subsection danger-zone">
                  <div class="card-header">
                    <div>
                      <span class="subsection-label">Remove countdown</span>
                      <p class="card-copy">
                        Clear the shared countdown, excluded dates, and daily alert settings for this server.
                      </p>
                    </div>
                  </div>
                  <div class="danger-zone-actions">
                    <button
                      class="button button-danger"
                      type="submit"
                      formaction="/dashboard/${guild.id}/countdown/remove"
                      formmethod="post"
                      formnovalidate
                      onclick="return window.confirm('Remove this server\\'s countdown and clear its alert settings?');"
                      ${hasSavedCountdown ? "" : "disabled"}
                    >
                      Remove countdown
                    </button>
                    <p class="preview-note">
                      ${hasSavedCountdown
                        ? "This clears the countdown module without touching welcome, auto-role, or core reply settings."
                        : "There is no saved countdown configuration to remove right now."}
                    </p>
                  </div>
                </div>
              </div>

              <aside class="preview-card">
                <span class="preview-label">Countdown preview</span>
                <div class="countdown-preview" data-countdown-preview>${countdownPreview}</div>
                <div class="preview-meta">
                  <div>
                    <span>Mode</span>
                    <strong data-countdown-mode-label>${escapeHtml(countdown.modeLabel)}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong data-countdown-status-label>${escapeHtml(getCountdownStatusLabel(countdown.state))}</strong>
                  </div>
                  <div>
                    <span>Target</span>
                    <strong data-countdown-target-label>${escapeHtml(countdown.targetDateLabel || "Not set")}</strong>
                  </div>
                </div>
                <p class="preview-note" data-countdown-meta-line>${escapeHtml(countdown.metaLine)}</p>
                <p
                  class="preview-note ${countdown.scheduleLine ? "" : "is-hidden"}"
                  data-countdown-schedule-line
                >
                  ${escapeHtml(countdown.scheduleLine || "")}
                </p>
                <p
                  class="preview-note ${countdown.breakdownLine ? "" : "is-hidden"}"
                  data-countdown-breakdown-line
                >
                  ${escapeHtml(countdown.breakdownLine || "")}
                </p>
                <p
                  class="preview-note ${countdown.ignoredExclusionsLine ? "" : "is-hidden"}"
                  data-countdown-ignored-line
                >
                  ${escapeHtml(countdown.ignoredExclusionsLine || "")}
                </p>

                <span class="preview-label">Daily alert preview</span>
                <div class="countdown-preview" data-countdown-alert-preview>${countdownAlertPreview}</div>
                <div class="preview-meta preview-meta-dual">
                  <div>
                    <span>Channel</span>
                    <strong data-countdown-alert-channel-label>${escapeHtml(countdownAlert.channelLabel)}</strong>
                  </div>
                  <div>
                    <span>Time</span>
                    <strong data-countdown-alert-time-label>${escapeHtml(countdownAlert.timeLabel)}</strong>
                  </div>
                </div>
                <p class="preview-note" data-countdown-alert-note>${escapeHtml(countdownAlert.note)}</p>
              </aside>
            </div>
          `,
          checked: settings.countdownEnabled,
          blockerHtml: escapeHtml(pageMeta?.moduleBlockers?.countdown || ""),
          descriptionHtml:
            "Configure one shared countdown that anyone in the server can check with <code>/countdown</code>.",
          eyebrow: "Countdown",
          inputName: "countdownEnabled",
          moduleKey: "countdown",
          moduleId: "countdown",
          statusHtml: `
            <div
              class="status-pill status-pill-${getCountdownStatusTone(countdown.state)}"
              data-status-target="countdown"
            >
              ${escapeHtml(getCountdownStatusLabel(countdown.state))}
            </div>
          `,
          summaryHtml: countdownSummaryHtml,
          theme: "countdown",
          titleHtml: "Server-wide event countdown",
        })}

        ${renderWelcomeModuleCard({
          blockerText: pageMeta?.moduleBlockers?.welcome || "",
          channelOptions,
          guildName: guild.name,
          settings,
        })}

        ${renderAutoRoleModuleCard({
          blockerText: pageMeta?.moduleBlockers?.autoRole || "",
          roleOptions,
          settings,
        })}

        <section class="save-bar" data-save-bar>
          <div class="save-bar-copy">
            <strong class="save-bar-title" data-save-title>All changes saved</strong>
            <p class="save-bar-note" data-save-status>
              Changes only apply to ${escapeHtml(guild.name)} after you save them.
            </p>
          </div>
          <div class="save-bar-actions">
            <button class="button button-ghost" type="reset" data-discard-button>Discard</button>
            <button class="button" type="submit" data-save-button>Save settings</button>
          </div>
        </section>
      </form>
    </main>
  `;

  return renderLayout({
    authConfig,
    body,
    sessionUser,
    title: `${guild.name} Settings`,
  });
}

function renderAuthComplete({ authConfig, returnTo, sessionUser }) {
  const body = `
    <main class="center-page">
      <section class="center-panel">
        <p class="eyebrow">Continental ID</p>
        <h1>Finishing sign-in</h1>
        <p class="lede">
          This page refreshes your Dashboard session, syncs it into Blueprint, and returns you
          to the control center.
        </p>
        <div class="hero-actions">
          <button class="button" id="relogin-button" type="button">Open sign-in</button>
        </div>
        <p class="helper-text" data-auth-complete="true" data-return-to="${escapeHtml(returnTo)}">
          Waiting for an active Continental ID session.
        </p>
      </section>
    </main>
  `;

  return renderLayout({
    authConfig,
    body,
    sessionUser,
    title: "Complete Sign-In",
  });
}

module.exports = {
  renderAuthComplete,
  renderDashboard,
  renderGuildSettings,
  renderHome,
};

function getCountdownStatusLabel(state) {
  if (state === "upcoming") {
    return "Live";
  }

  if (state === "today") {
    return "Today";
  }

  if (state === "past") {
    return "Ended";
  }

  if (state === "incomplete") {
    return "Needs setup";
  }

  return "Disabled";
}

function getCountdownStatusTone(state) {
  if (state === "upcoming") {
    return "live";
  }

  if (state === "today") {
    return "today";
  }

  if (state === "past") {
    return "ended";
  }

  if (state === "incomplete") {
    return "incomplete";
  }

  return "disabled";
}

function getCountdownModeCopy(mode) {
  if (mode === "active-days") {
    return "Count only selected weekdays after today and before the target date. Excluded dates only reduce the countdown when they fall on one of those counted days.";
  }

  return "Count every calendar day from today to the target date.";
}

function renderCountdownAlertTimeZoneOptions(selectedTimeZone) {
  const safeSelectedTimeZone = String(selectedTimeZone || DEFAULT_DAILY_ALERT_TIME_ZONE);
  const commonTimeZones = Array.from(
    new Set([safeSelectedTimeZone, ...COMMON_DAILY_ALERT_TIME_ZONES]),
  ).filter((timeZone) => SUPPORTED_DAILY_ALERT_TIME_ZONES.includes(timeZone));
  const commonTimeZoneSet = new Set(commonTimeZones);
  const allOtherTimeZones = SUPPORTED_DAILY_ALERT_TIME_ZONES.filter(
    (timeZone) => !commonTimeZoneSet.has(timeZone),
  );

  return [
    `<optgroup label="Common time zones">${commonTimeZones
      .map((timeZone) => renderCountdownAlertTimeZoneOption(timeZone, safeSelectedTimeZone))
      .join("")}</optgroup>`,
    `<optgroup label="All time zones">${allOtherTimeZones
      .map((timeZone) => renderCountdownAlertTimeZoneOption(timeZone, safeSelectedTimeZone))
      .join("")}</optgroup>`,
  ].join("");
}

function renderCountdownAlertTimeZoneOption(timeZone, selectedTimeZone) {
  return `
    <option value="${escapeHtml(timeZone)}" ${timeZone === selectedTimeZone ? "selected" : ""}>
      ${escapeHtml(timeZone)}
    </option>
  `;
}

function formatExcludedDateChipLabel(isoDate) {
  return formatDateLabel(isoDate) || isoDate;
}
