const path = require("node:path");

const express = require("express");
const session = require("express-session");
const {
  ChatInputCommandInteraction,
  Client,
  DiscordAPIError,
  Events,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");

const config = require("./config");
const {
  renderAuthComplete,
  renderDashboard,
  renderGuildSettings,
  renderHome,
} = require("./render");
const {
  buildCountdownAlertMessage,
  clearCountdownSettings,
  DEFAULT_DAILY_ALERT_TIME,
  getCurrentIsoDateInTimeZone,
  getCountdownResult,
  normalizeCountdownAlertTime,
  normalizeCountdownAlertTimeZone,
  normalizeCountdownMode,
  normalizeExcludedDatesInput,
  normalizeIsoDateInput,
  normalizeWeekdaySelection,
  shouldSendCountdownAlert,
  validateCountdownSettings,
} = require("./countdown");
const {
  assignAutoRole,
  getAutoRoleState,
  getAutoRoleOptions,
  normalizeAutoRoleSettings,
  validateAutoRoleSettings,
} = require("./modules/auto-role");
const {
  getWelcomeChannelOptions,
  getWelcomeState,
  normalizeWelcomeSettings,
  sendWelcomeMessage,
  validateWelcomeSettings,
} = require("./modules/welcome");
const {
  clearCountdownAlertLastSentOn,
  getCountdownAlertLastSentOn,
  getGuildSettings,
  saveGuildSettings,
  setCountdownAlertLastSentOn,
} = require("./storage");

if (!config.token || !config.clientId || !config.sessionSecret) {
  console.error(
    "Missing required environment variables. Set DISCORD_TOKEN, DISCORD_CLIENT_ID, and DISCORD_SESSION_SECRET.",
  );
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with the server's configured ping response."),
  new SlashCommandBuilder()
    .setName("hello")
    .setDescription("Replies with the server's configured hello message."),
  new SlashCommandBuilder()
    .setName("dashboard")
    .setDescription("Shows the control center URL for this bot."),
  new SlashCommandBuilder()
    .setName("countdown")
    .setDescription("Shows the server's configured countdown."),
];

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const app = express();
const invitePermissions = new PermissionsBitField([
  PermissionsBitField.Flags.Administrator,
]).bitfield.toString();
const addBotUrl =
  `https://discord.com/oauth2/authorize?client_id=${config.clientId}` +
  `&scope=bot%20applications.commands&permissions=${invitePermissions}`;

app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7,
      sameSite: "lax",
      secure: config.baseUrl.startsWith("https://"),
    },
  }),
);
app.use(express.static(path.join(process.cwd(), "public")));
app.use("/images", express.static(path.join(process.cwd(), "images")));
app.get("/favicon.ico", (request, response) => {
  response.sendFile(path.join(process.cwd(), "images", "blueprint-pfp2.png"));
});
app.use(
  "/auth-popup",
  express.static(path.resolve(process.cwd(), "..", "Dashboard", "login popup")),
);

app.use((request, response, next) => {
  response.locals.sessionUser = request.session.user || null;
  next();
});

app.get("/", (request, response) => {
  response.send(
    renderHome({
      authConfig: getAuthClientConfig(),
      sessionUser: response.locals.sessionUser,
    }),
  );
});

app.get("/auth/complete", (request, response) => {
  response.send(
    renderAuthComplete({
      authConfig: getAuthClientConfig(),
      returnTo: normalizeReturnTo(request.query.returnTo),
      sessionUser: response.locals.sessionUser,
    }),
  );
});

app.post("/auth/session", async (request, response, next) => {
  try {
    const accessToken = normalizeToken(request.body.accessToken);
    if (!accessToken) {
      response.status(400).json({ message: "Access token required." });
      return;
    }

    const authPayload = await fetchAuthProfile(accessToken);
    const sessionUser = buildSessionUser(authPayload);

    request.session.accessToken = accessToken;
    request.session.user = sessionUser;

    response.json({
      authenticated: true,
      discordLinked: sessionUser.discordLinked,
      user: sessionUser,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/auth/link/discord/start", requireAuthJson, async (request, response, next) => {
  try {
    const payload = await fetchAuthJson("/api/auth/oauth/discord/link-start", {
      accessToken: request.session.accessToken,
      body: {
        origin: config.baseUrl,
        redirect: `${config.authCompleteUrl}?returnTo=${encodeURIComponent(
          normalizeReturnTo(request.body.returnTo),
        )}`,
        returnTo: `${config.authCompleteUrl}?returnTo=${encodeURIComponent(
          normalizeReturnTo(request.body.returnTo),
        )}`,
      },
      headers: {
        Origin: config.baseUrl,
        Referer: `${config.baseUrl}${normalizeReturnTo(request.body.returnTo)}`,
      },
      method: "POST",
    });

    response.json(payload);
  } catch (error) {
    next(error);
  }
});

app.get("/logout", (request, response) => {
  request.session.destroy(() => {
    response.redirect("/");
  });
});

app.get("/dashboard", requireAuthPage, async (request, response, next) => {
  try {
    const guilds = request.session.user.discordUserId
      ? await getManageableGuilds(request.session.user.discordUserId)
      : [];

    response.send(
      renderDashboard({
        addBotUrl,
        authConfig: getAuthClientConfig(),
        discordLinked: Boolean(request.session.user.discordLinked),
        guilds,
        sessionUser: response.locals.sessionUser,
      }),
    );
  } catch (error) {
    next(error);
  }
});

app.get("/dashboard/:guildId", requireAuthPage, async (request, response, next) => {
  try {
    const guild = await getManagedGuild(
      request.session.user.discordUserId,
      request.params.guildId,
    );

    if (!guild) {
      response.status(404).send("Server not found or not manageable.");
      return;
    }

    const dashboardOptions = await getGuildDashboardOptions(guild);
    const settings = getGuildSettings(guild.id);
    const pageMeta = buildGuildPageMeta({
      botMember: dashboardOptions.botMember,
      channelOptions: dashboardOptions.channelOptions,
      guild,
      roleOptions: dashboardOptions.roleOptions,
      settings,
    });

    response.send(
      renderGuildSettings({
        authConfig: getAuthClientConfig(),
        channelOptions: dashboardOptions.channelOptions,
        guild,
        pageMeta,
        roleOptions: dashboardOptions.roleOptions,
        saveMessage: getSettingsSaveMessage(request.query.saved),
        sessionUser: response.locals.sessionUser,
        settings,
      }),
    );
  } catch (error) {
    next(error);
  }
});

app.post("/dashboard/:guildId", requireAuthPage, async (request, response, next) => {
  try {
    const guild = await getManagedGuild(
      request.session.user.discordUserId,
      request.params.guildId,
    );

    if (!guild) {
      response.status(404).send("Server not found or not manageable.");
      return;
    }

    const dashboardOptions = await getGuildDashboardOptions(guild);
    const settings = {
      pingResponse: normalizeText(request.body.pingResponse, "Pong.", 120),
      helloEnabled: request.body.helloEnabled === "on",
      helloTemplate: normalizeText(request.body.helloTemplate, "Hello, {user}.", 160),
      accentColor: normalizeColor(request.body.accentColor),
      countdownEnabled: request.body.countdownEnabled === "on",
      countdownTitle: normalizeText(request.body.countdownTitle, "", 80),
      countdownTargetDate: normalizeIsoDateInput(request.body.countdownTargetDate),
      countdownMode: normalizeCountdownMode(request.body.countdownMode),
      countdownWeekdays: normalizeWeekdaySelection(request.body.countdownWeekdays),
      countdownExcludedDates: normalizeExcludedDatesInput(
        request.body.countdownExcludedDates,
      ),
      countdownAlertEnabled: request.body.countdownAlertEnabled === "on",
      countdownAlertChannelId: normalizeId(request.body.countdownAlertChannelId),
      countdownAlertTime: normalizeCountdownAlertTime(
        request.body.countdownAlertTime,
        DEFAULT_DAILY_ALERT_TIME,
      ),
      countdownAlertTimeZone: normalizeCountdownAlertTimeZone(
        request.body.countdownAlertTimeZone,
      ),
      ...normalizeWelcomeSettings(request.body),
      ...normalizeAutoRoleSettings(request.body),
    };
    const botMember = await getBotGuildMember(guild);
    const validationErrors = [
      ...validateCountdownSettings(settings, guild, botMember),
      ...validateWelcomeSettings(settings, guild, botMember),
      ...validateAutoRoleSettings(settings, guild, botMember),
    ];
    const pageMeta = buildGuildPageMeta({
      botMember,
      channelOptions: dashboardOptions.channelOptions,
      guild,
      roleOptions: dashboardOptions.roleOptions,
      settings,
    });

    if (validationErrors.length > 0) {
      response.status(400).send(
        renderGuildSettings({
          authConfig: getAuthClientConfig(),
          channelOptions: dashboardOptions.channelOptions,
          errorMessage: validationErrors[0],
          guild,
          pageMeta,
          roleOptions: dashboardOptions.roleOptions,
          saveMessage: "",
          sessionUser: response.locals.sessionUser,
          settings,
        }),
      );
      return;
    }

    saveGuildSettings(
      guild.id,
      settings,
      request.session.user.id,
    );

    response.redirect(`/dashboard/${guild.id}?saved=1`);
  } catch (error) {
    next(error);
  }
});

app.post("/dashboard/:guildId/countdown/remove", requireAuthPage, async (request, response, next) => {
  try {
    const guild = await getManagedGuild(
      request.session.user.discordUserId,
      request.params.guildId,
    );

    if (!guild) {
      response.status(404).send("Server not found or not manageable.");
      return;
    }

    saveGuildSettings(
      guild.id,
      clearCountdownSettings(getGuildSettings(guild.id)),
      request.session.user.id,
    );
    clearCountdownAlertLastSentOn(guild.id);

    response.redirect(`/dashboard/${guild.id}?saved=countdown-removed`);
  } catch (error) {
    next(error);
  }
});

app.use((error, request, response, next) => {
  console.error(error);

  if (response.headersSent) {
    next(error);
    return;
  }

  if (error.statusCode === 401) {
    if (request.path.startsWith("/auth/")) {
      response.status(401).json({ message: error.message || "Authentication required." });
      return;
    }

    request.session.destroy(() => {
      response.redirect(
        `/auth/complete?returnTo=${encodeURIComponent(
          normalizeReturnTo(request.originalUrl || "/dashboard"),
        )}`,
      );
    });
    return;
  }

  response.status(500).send("Something went wrong.");
});

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(config.token);
  const body = commands.map((command) => command.toJSON());

  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
      body,
    });
    console.log(`Registered ${body.length} guild slash commands.`);
    return;
  }

  await rest.put(Routes.applicationCommands(config.clientId), { body });
  console.log(`Registered ${body.length} global slash commands.`);
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  startCountdownAlertScheduler();
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  await handleCommand(interaction);
});

client.on(Events.GuildMemberAdd, async (member) => {
  const settings = getGuildSettings(member.guild.id);

  try {
    await assignAutoRole(member, settings);
    await sendWelcomeMessage(member, settings);
  } catch (error) {
    console.error(`Failed onboarding flow for guild ${member.guild.id}.`);
    console.error(error);
  }
});

/**
 * @param {ChatInputCommandInteraction} interaction
 */
async function handleCommand(interaction) {
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;

  if (interaction.commandName === "ping") {
    await interaction.reply(settings?.pingResponse || "Pong.");
    return;
  }

  if (interaction.commandName === "hello") {
    if (interaction.guildId && settings && !settings.helloEnabled) {
      await interaction.reply({
        content: "The hello command is disabled in this server.",
        ephemeral: true,
      });
      return;
    }

    const template = settings?.helloTemplate || "Hello, {user}.";
    const message = template
      .replaceAll("{user}", interaction.user.username)
      .replaceAll("{server}", interaction.guild?.name || "this server");

    await interaction.reply(message);
    return;
  }

  if (interaction.commandName === "dashboard") {
    await interaction.reply(`Control center: ${config.baseUrl}`);
    return;
  }

  if (interaction.commandName === "countdown") {
    const countdown = getCountdownResult(settings || {});
    await interaction.reply({
      content: countdown.commandPreview,
      ephemeral: countdown.state === "disabled" || countdown.state === "incomplete",
    });
    return;
  }

  await interaction.reply({
    content: "Unknown command.",
    ephemeral: true,
  });
}

function requireAuthPage(request, response, next) {
  if (!request.session.user) {
    response.redirect(
      `/auth/complete?returnTo=${encodeURIComponent(
        normalizeReturnTo(request.originalUrl || "/dashboard"),
      )}`,
    );
    return;
  }

  next();
}

function requireAuthJson(request, response, next) {
  if (!request.session.user || !request.session.accessToken) {
    response.status(401).json({ message: "Authentication required." });
    return;
  }

  next();
}

async function fetchAuthJson(
  endpoint,
  { accessToken, body, headers: extraHeaders = {}, method = "GET" } = {},
) {
  const headers = { ...extraHeaders };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const result = await fetch(`${config.authApiBaseUrl}${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await result.json().catch(() => ({}));

  if (!result.ok) {
    const error = new Error(payload.message || `Auth request failed with ${result.status}.`);
    error.statusCode = result.status;
    throw error;
  }

  return payload;
}

async function fetchAuthProfile(accessToken) {
  const payload = await fetchAuthJson("/api/auth/me", { accessToken });
  return payload.user || payload;
}

function buildSessionUser(user) {
  const discordProvider = user.oauthProviders?.discord || {};
  const avatarUrl = normalizeText(
    user.profile?.avatar || discordProvider.avatarUrl || "",
    "",
    1000,
  );

  return {
    avatarUrl,
    discordLinked: Boolean(discordProvider.linked && discordProvider.providerUserId),
    discordProviderUsername: normalizeText(discordProvider.username, "", 120),
    discordUserId: normalizeText(discordProvider.providerUserId, "", 160),
    id: normalizeText(user.userId || user.continentalId, "", 80),
    username: normalizeText(user.displayName || user.username, "User", 80),
  };
}

function getAuthClientConfig() {
  const loginPopupOrigin = safeOriginFromUrl(config.authLoginPopupUrl);
  const trustedLoginOrigins = Array.from(
    new Set([loginPopupOrigin, ...config.authTrustedLoginOrigins].filter(Boolean)),
  );

  return {
    authApiBaseUrl: config.authApiBaseUrl,
    authCompleteUrl: config.authCompleteUrl,
    authLoginPopupUrl: config.authLoginPopupUrl,
    baseUrl: config.baseUrl,
    trustedLoginOrigins,
  };
}

async function getManageableGuilds(discordUserId) {
  const results = await Promise.all(
    client.guilds.cache.map(async (guild) => {
      try {
        const member = await guild.members.fetch(discordUserId);
        if (
          !member.permissions.has(PermissionsBitField.Flags.Administrator) &&
          !member.permissions.has(PermissionsBitField.Flags.ManageGuild)
        ) {
          return null;
        }

        const settings = getGuildSettings(guild.id);
        const summary = buildGuildDashboardSummary(settings);

        return {
          attentionCount: summary.attentionCount,
          enabledCount: summary.enabledCount,
          iconUrl: guild.iconURL({ size: 128 }),
          id: guild.id,
          name: guild.name,
          statusLabel: summary.statusLabel,
          statusTone: summary.statusTone,
          updatedAtLabel: summary.updatedAtLabel,
        };
      } catch (error) {
        if (
          error instanceof DiscordAPIError &&
          (error.status === 404 || error.code === 10007)
        ) {
          return null;
        }

        throw error;
      }
    }),
  );

  return results
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function getManagedGuild(discordUserId, guildId) {
  if (!discordUserId) {
    return null;
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return null;
  }

  try {
    const member = await guild.members.fetch(discordUserId);
    if (
      !member.permissions.has(PermissionsBitField.Flags.Administrator) &&
      !member.permissions.has(PermissionsBitField.Flags.ManageGuild)
    ) {
      return null;
    }

    return guild;
  } catch (error) {
    if (
      error instanceof DiscordAPIError &&
      (error.status === 404 || error.code === 10007)
    ) {
      return null;
    }

    throw error;
  }
}

async function getGuildDashboardOptions(guild) {
  await Promise.all([guild.channels.fetch(), guild.roles.fetch()]);
  const botMember = await getBotGuildMember(guild);

  return {
    botMember,
    channelOptions: getWelcomeChannelOptions(guild, botMember),
    roleOptions: getAutoRoleOptions(guild, botMember),
  };
}

let countdownAlertSweepInFlight = false;

function startCountdownAlertScheduler() {
  void runCountdownAlertSweep();

  setInterval(() => {
    void runCountdownAlertSweep();
  }, 30_000);
}

async function runCountdownAlertSweep() {
  if (countdownAlertSweepInFlight) {
    return;
  }

  countdownAlertSweepInFlight = true;

  try {
    const now = new Date();

    for (const guild of client.guilds.cache.values()) {
      try {
        const settings = getGuildSettings(guild.id);
        const lastSentOn = getCountdownAlertLastSentOn(guild.id);

        if (!shouldSendCountdownAlert(settings, now, lastSentOn)) {
          continue;
        }

        await guild.channels.fetch();
        const botMember = await getBotGuildMember(guild);
        const errors = validateCountdownSettings(settings, guild, botMember);
        if (errors.length > 0) {
          continue;
        }

        const channel = guild.channels.cache.get(settings.countdownAlertChannelId);
        if (!channel || !channel.isTextBased()) {
          continue;
        }

        await channel.send(buildCountdownAlertMessage(settings, { now }));
        setCountdownAlertLastSentOn(
          guild.id,
          getCurrentIsoDateInTimeZone(
            now,
            normalizeCountdownAlertTimeZone(settings.countdownAlertTimeZone),
          ),
        );
      } catch (error) {
        console.error(`Countdown alert failed for guild ${guild.id}.`);
        console.error(error);
      }
    }
  } catch (error) {
    console.error("Countdown alert sweep failed.");
    console.error(error);
  } finally {
    countdownAlertSweepInFlight = false;
  }
}

async function getBotGuildMember(guild) {
  if (guild.members.me) {
    return guild.members.me;
  }

  return guild.members.fetch(client.user.id);
}

function normalizeColor(value) {
  if (/^#[0-9a-fA-F]{6}$/.test(String(value || ""))) {
    return value;
  }

  return "#5865f2";
}

function normalizeReturnTo(value) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("/")) {
    return "/dashboard";
  }

  if (raw.startsWith("//")) {
    return "/dashboard";
  }

  return raw;
}

function normalizeText(value, fallback, maxLength) {
  const trimmed = String(value || "")
    .trim()
    .slice(0, maxLength);

  return trimmed || fallback;
}

function normalizeToken(value) {
  return normalizeText(value, "", 5000);
}

function normalizeId(value) {
  return /^\d{16,20}$/.test(String(value || "").trim()) ? String(value).trim() : "";
}

function getSettingsSaveMessage(savedState) {
  if (savedState === "countdown-removed") {
    return "Countdown removed.";
  }

  return savedState ? "Settings updated." : "";
}

function buildGuildDashboardSummary(settings) {
  const countdown = getCountdownResult(settings);
  const countdownAlert = getCountdownAlertSummary(settings);
  const welcomeState = getWelcomeState(settings);
  const autoRoleState = getAutoRoleState(settings);
  const enabledCount = [settings.countdownEnabled, settings.welcomeEnabled, settings.autoRoleEnabled]
    .filter(Boolean)
    .length;
  const attentionCount = [
    settings.countdownEnabled &&
      (countdown.state === "incomplete" ||
        (settings.countdownAlertEnabled && countdownAlert.state === "incomplete")),
    settings.welcomeEnabled && welcomeState === "incomplete",
    settings.autoRoleEnabled && autoRoleState === "incomplete",
  ].filter(Boolean).length;

  return {
    attentionCount,
    enabledCount,
    statusLabel:
      attentionCount > 0 ? "Needs attention" : enabledCount > 0 ? "Ready" : "No modules enabled",
    statusTone: attentionCount > 0 ? "incomplete" : enabledCount > 0 ? "live" : "disabled",
    updatedAtLabel: formatUpdatedAtLabel(settings.updatedAt),
  };
}

function buildGuildPageMeta({
  botMember,
  channelOptions,
  guild,
  roleOptions,
  settings,
}) {
  const countdown = getCountdownResult(settings);
  const countdownAlert = getCountdownAlertSummary(settings, channelOptions, countdown);
  const countdownErrors = validateCountdownSettings(settings, guild, botMember);
  const welcomeErrors = validateWelcomeSettings(settings, guild, botMember);
  const autoRoleErrors = validateAutoRoleSettings(settings, guild, botMember);
  const modules = [
    {
      enabled: settings.countdownEnabled,
      key: "countdown",
      blocker:
        !settings.countdownEnabled
          ? ""
          : countdownErrors[0] ||
            (countdown.state === "incomplete"
              ? "Add an event name and target date to finish setup."
              : ""),
    },
    {
      enabled: settings.welcomeEnabled,
      key: "welcome",
      blocker:
        !settings.welcomeEnabled
          ? ""
          : welcomeErrors[0] ||
            (getWelcomeState(settings, channelOptions) === "incomplete"
              ? "Choose a welcome channel and message to finish setup."
              : ""),
    },
    {
      enabled: settings.autoRoleEnabled,
      key: "autoRole",
      blocker:
        !settings.autoRoleEnabled
          ? ""
          : autoRoleErrors[0] ||
            (getAutoRoleState(settings, roleOptions) === "incomplete"
              ? "Select a default role to finish setup."
              : ""),
    },
  ];
  const attentionModules = modules.filter((module) => module.enabled && module.blocker).length;
  const enabledModules = modules.filter((module) => module.enabled).length;

  return {
    attentionModules,
    countdownAlertState: countdownAlert.state,
    enabledModules,
    helloEnabled: settings.helloEnabled,
    lastUpdatedLabel: formatUpdatedAtLabel(settings.updatedAt),
    moduleBlockers: {
      autoRole: modules.find((module) => module.key === "autoRole")?.blocker || "",
      countdown: modules.find((module) => module.key === "countdown")?.blocker || "",
      welcome: modules.find((module) => module.key === "welcome")?.blocker || "",
    },
  };
}

function formatUpdatedAtLabel(value) {
  if (!value) {
    return "Not saved yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently updated";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(date) + " UTC";
}

function safeOriginFromUrl(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

async function start() {
  await registerCommands();
  await client.login(config.token);

  app.listen(config.port, () => {
    console.log(`Control center running at ${config.baseUrl}`);
  });
}

start().catch((error) => {
  console.error("Failed to start app.");
  console.error(error);
  process.exit(1);
});
