const path = require("node:path");

require("dotenv").config();

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_AUTH_API_BASE_URL = "http://localhost:5000";
const DEFAULT_AUTH_LOGIN_POPUP_URL = "https://login.continental-hub.com/popup.html";

const config = {
  authApiBaseUrl: (process.env.AUTH_API_BASE_URL || DEFAULT_AUTH_API_BASE_URL).replace(
    /\/$/,
    "",
  ),
  authLoginPopupUrl:
    process.env.AUTH_LOGIN_POPUP_URL || DEFAULT_AUTH_LOGIN_POPUP_URL,
  authTrustedLoginOrigins: String(
    process.env.AUTH_TRUSTED_LOGIN_ORIGINS || "",
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  baseUrl: (process.env.BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ""),
  clientId: process.env.DISCORD_CLIENT_ID,
  dataDir: path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data")),
  guildId: process.env.DISCORD_GUILD_ID,
  isProduction: process.env.NODE_ENV === "production",
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number.parseInt(process.env.PORT || "3000", 10),
  sessionCookieName: process.env.SESSION_COOKIE_NAME || "blueprint.sid",
  sessionSecret: process.env.DISCORD_SESSION_SECRET,
  token: process.env.DISCORD_TOKEN,
};

config.authCompleteUrl = `${config.baseUrl}/auth/complete`;

function validateRuntimeConfig(runtimeConfig = config) {
  const errors = [];
  const warnings = [];

  if (!runtimeConfig.token) {
    errors.push("DISCORD_TOKEN is required.");
  }
  if (!runtimeConfig.clientId) {
    errors.push("DISCORD_CLIENT_ID is required.");
  }
  if (!runtimeConfig.sessionSecret) {
    errors.push("DISCORD_SESSION_SECRET is required.");
  }
  if (!Number.isInteger(runtimeConfig.port) || runtimeConfig.port < 1 || runtimeConfig.port > 65535) {
    errors.push("PORT must be an integer between 1 and 65535.");
  }

  validateUrl("BASE_URL", runtimeConfig.baseUrl, errors);
  validateUrl("AUTH_API_BASE_URL", runtimeConfig.authApiBaseUrl, errors);
  validateUrl("AUTH_LOGIN_POPUP_URL", runtimeConfig.authLoginPopupUrl, errors);

  if (runtimeConfig.isProduction) {
    if (!runtimeConfig.baseUrl.startsWith("https://")) {
      errors.push("BASE_URL must use HTTPS when NODE_ENV=production.");
    }
    if (!runtimeConfig.authLoginPopupUrl.startsWith("https://")) {
      errors.push("AUTH_LOGIN_POPUP_URL must use HTTPS when NODE_ENV=production.");
    }
    if (runtimeConfig.authApiBaseUrl === DEFAULT_AUTH_API_BASE_URL) {
      errors.push("AUTH_API_BASE_URL must be set explicitly when NODE_ENV=production.");
    }
    if (String(runtimeConfig.sessionSecret || "").length < 32) {
      errors.push("DISCORD_SESSION_SECRET must be at least 32 characters when NODE_ENV=production.");
    }
  } else if (String(runtimeConfig.sessionSecret || "").length > 0 && String(runtimeConfig.sessionSecret).length < 32) {
    warnings.push("DISCORD_SESSION_SECRET should be at least 32 characters before production deployment.");
  }

  return { errors, warnings };
}

function validateUrl(name, value, errors) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      errors.push(`${name} must use HTTP or HTTPS.`);
    }
  } catch {
    errors.push(`${name} must be a valid URL.`);
  }
}

config.validateRuntimeConfig = validateRuntimeConfig;

module.exports = config;
