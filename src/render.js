const {
  WEEKDAY_OPTIONS,
  excludedDatesToTextarea,
  getCountdownResult,
} = require("./countdown");
const { escapeHtml } = require("./html");
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
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div class="page-shell">
      <header class="topbar">
        <a class="brand" href="/">Blueprint Control Center</a>
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
      <section class="panel">
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
  const selectedWeekdays = new Set(settings.countdownWeekdays || []);
  const countdownPreview = escapeHtml(countdown.commandPreview).replaceAll("\n", "<br />");
  const countdownStatusClass = `countdown-status countdown-status-${countdown.state}`;
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

            <label class="checkbox-row checkbox-row-wide">
              <input
                type="checkbox"
                name="helloEnabled"
                value="on"
                ${settings.helloEnabled ? "checked" : ""}
              />
              <span>Enable the <code>/hello</code> command in this server</span>
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
              <label class="checkbox-row">
                <input
                  type="checkbox"
                  name="countdownEnabled"
                  value="on"
                  ${settings.countdownEnabled ? "checked" : ""}
                />
                <span>Enable the <code>/countdown</code> command in this server</span>
              </label>

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
                  <small>Use one ISO date per line for holidays, breaks, or any day that should be skipped.</small>
                </label>
              </div>
            </div>

            <aside class="preview-card">
              <span class="preview-label">Slash command preview</span>
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
    return "Count only chosen weekdays before the target date and skip any excluded dates.";
  }

  return "Count every calendar day from today to the target date.";
}
