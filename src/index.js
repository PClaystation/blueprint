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
  getCountdownResult,
  normalizeCountdownMode,
  normalizeExcludedDatesInput,
  normalizeIsoDateInput,
  normalizeWeekdaySelection,
} = require("./countdown");
const { getGuildSettings, saveGuildSettings } = require("./storage");

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
  PermissionsBitField.Flags.ViewChannel,
  PermissionsBitField.Flags.SendMessages,
  PermissionsBitField.Flags.ReadMessageHistory,
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

    response.send(
      renderGuildSettings({
        authConfig: getAuthClientConfig(),
        guild,
        saveMessage: request.query.saved ? "Settings updated." : "",
        sessionUser: response.locals.sessionUser,
        settings: getGuildSettings(guild.id),
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

    saveGuildSettings(
      guild.id,
      {
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
      },
      request.session.user.id,
    );

    response.redirect(`/dashboard/${guild.id}?saved=1`);
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
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  await handleCommand(interaction);
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

async function fetchAuthJson(endpoint, { accessToken, body, method = "GET" } = {}) {
  const headers = {};
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

        return {
          iconUrl: guild.iconURL({ size: 128 }),
          id: guild.id,
          name: guild.name,
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

    return {
      iconUrl: guild.iconURL({ size: 128 }),
      id: guild.id,
      name: guild.name,
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
