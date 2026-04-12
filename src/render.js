function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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
  guild,
  saveMessage,
  sessionUser,
  settings,
}) {
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

      <form class="settings-form" method="post" action="/dashboard/${guild.id}">
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

        <label class="checkbox-row">
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
