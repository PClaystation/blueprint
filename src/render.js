const {
  getCountdownAlertStatusLabel,
  getCountdownAlertSummary,
  WEEKDAY_OPTIONS,
  excludedDatesToTextarea,
  getCountdownResult,
} = require("./countdown");
const { escapeHtml, renderFeatureToggle } = require("./html");
const { renderAutoRoleModuleCard } = require("./modules/auto-role");
const { renderWelcomeModuleCard } = require("./modules/welcome");

function renderLayout({
  authConfig,
  body,
  sessionUser,
  title,
}) {
  const authButton = sessionUser
    ? `<a class="button button-ghost" href="/logout">Log out</a>`
    : `<button class="button button-ghost" id="login-button" type="button">Log in</button>`;

  const authMeta = sessionUser
    ? `<div class="user-chip">
        ${sessionUser.avatarUrl ? `<img src="${escapeHtml(sessionUser.avatarUrl)}" alt="" />` : ""}
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
  const cards = guilds
    .map((guild) => {
      const icon = guild.iconUrl
        ? `<img class="server-avatar-image" src="${escapeHtml(guild.iconUrl)}" alt="" />`
        : escapeHtml(guild.name.slice(0, 2).toUpperCase());

      return `
        <article class="server-card">
          <div class="server-card-head">
            <div class="server-avatar">${icon}</div>
            <div>
              <h2>${escapeHtml(guild.name)}</h2>
              <p>Installed and manageable by your linked Discord account</p>
            </div>
          </div>
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
      ${discordNotice}
      <section class="server-grid">
        ${cards || `<div class="empty-state">${escapeHtml(emptyState)}</div>`}
      </section>
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
  roleOptions,
  saveMessage,
  sessionUser,
  settings,
}) {
  const countdown = getCountdownResult(settings);
  const countdownAlert = getCountdownAlertSummary(settings, channelOptions, countdown);
  const selectedWeekdays = new Set(settings.countdownWeekdays || []);
  const countdownPreview = escapeHtml(countdown.commandPreview).replaceAll("\n", "<br />");
  const countdownAlertPreview = escapeHtml(countdownAlert.preview).replaceAll("\n", "<br />");
  const countdownStatusClass = `countdown-status countdown-status-${countdown.state}`;
  const countdownAlertStatusClass = `status-pill status-pill-${countdownAlert.state}`;
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

  const body = `
    <main class="settings-page">
      <section class="section-header">
        <div>
          <p class="eyebrow">Server settings</p>
          <h1>${escapeHtml(guild.name)}</h1>
        </div>
        <a class="button button-ghost" href="/dashboard">Back</a>
      </section>

      ${saveMessage ? `<div class="notice">${escapeHtml(saveMessage)}</div>` : ""}
      ${errorMessage ? `<div class="notice notice-error">${escapeHtml(errorMessage)}</div>` : ""}

      <form class="settings-stack" method="post" action="/dashboard/${guild.id}">
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

        <section class="settings-card countdown-card">
          <div class="card-header card-header-spread">
            <div>
              <p class="eyebrow">Countdown</p>
              <h2>Server-wide event countdown</h2>
              <p class="card-copy">
                Configure one shared countdown that anyone in the server can check with
                <code>/countdown</code>.
              </p>
            </div>
            <div class="${countdownStatusClass}">${escapeHtml(getCountdownStatusLabel(countdown.state))}</div>
          </div>

          <div class="countdown-layout">
            <div class="countdown-fields">
              ${renderFeatureToggle({
                checked: settings.countdownEnabled,
                descriptionHtml:
                  "Turn the shared <code>/countdown</code> module on or off for the whole server. When disabled, Blueprint stops surfacing the event entirely.",
                disabledLabel: "Module off",
                enabledLabel: "Module on",
                inputName: "countdownEnabled",
                kindLabel: "Module status",
                titleHtml: "Countdown visibility",
              })}

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

                <label>
                  <span>Excluded dates</span>
                  <textarea
                    name="countdownExcludedDates"
                    rows="6"
                    placeholder="2026-06-19&#10;2026-06-20"
                  >${escapeHtml(excludedDatesToTextarea(settings.countdownExcludedDates))}</textarea>
                  <small>
                    Use one ISO date per line for days that should not count. Blueprint only removes a date
                    when it is a selected weekday after today and before the target date.
                  </small>
                </label>
              </div>

              <div class="subsection">
                <div class="card-header card-header-spread subsection-header">
                  <div>
                    <span class="subsection-label">Daily alerts</span>
                    <p class="card-copy">
                      Post one countdown update per day in a chosen channel at a fixed UTC time.
                    </p>
                  </div>
                  <div class="${countdownAlertStatusClass}">
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
                    <span>Send time</span>
                    <input
                      type="time"
                      name="countdownAlertTime"
                      value="${escapeHtml(settings.countdownAlertTime)}"
                    />
                    <small>Uses UTC so the schedule stays stable across deployments.</small>
                  </label>
                </div>
              </div>
            </div>

            <aside class="preview-card">
              <span class="preview-label">Countdown preview</span>
              <div class="countdown-preview">${countdownPreview}</div>
              <div class="preview-meta">
                <div>
                  <span>Mode</span>
                  <strong>${escapeHtml(countdown.modeLabel)}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>${escapeHtml(getCountdownStatusLabel(countdown.state))}</strong>
                </div>
                <div>
                  <span>Target</span>
                  <strong>${escapeHtml(countdown.targetDateLabel || "Not set")}</strong>
                </div>
              </div>
              <p class="preview-note">${escapeHtml(countdown.metaLine)}</p>
              ${countdown.scheduleLine ? `<p class="preview-note">${escapeHtml(countdown.scheduleLine)}</p>` : ""}
              ${countdown.breakdownLine ? `<p class="preview-note">${escapeHtml(countdown.breakdownLine)}</p>` : ""}
              ${countdown.ignoredExclusionsLine ? `<p class="preview-note">${escapeHtml(countdown.ignoredExclusionsLine)}</p>` : ""}

              <span class="preview-label">Daily alert preview</span>
              <div class="countdown-preview">${countdownAlertPreview}</div>
              <div class="preview-meta preview-meta-dual">
                <div>
                  <span>Channel</span>
                  <strong>${escapeHtml(countdownAlert.channelLabel)}</strong>
                </div>
                <div>
                  <span>Time</span>
                  <strong>${escapeHtml(countdownAlert.timeLabel)}</strong>
                </div>
              </div>
              <p class="preview-note">${escapeHtml(countdownAlert.note)}</p>
            </aside>
          </div>
        </section>

        ${renderWelcomeModuleCard({
          channelOptions,
          guildName: guild.name,
          settings,
        })}

        ${renderAutoRoleModuleCard({
          roleOptions,
          settings,
        })}

        <button class="button" type="submit">Save settings</button>
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

function getCountdownModeCopy(mode) {
  if (mode === "active-days") {
    return "Count only selected weekdays after today and before the target date. Excluded dates only reduce the countdown when they fall on one of those counted days.";
  }

  return "Count every calendar day from today to the target date.";
}
