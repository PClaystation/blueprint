require("dotenv").config();

const config = {
  authApiBaseUrl: (process.env.AUTH_API_BASE_URL || "http://localhost:5000").replace(
    /\/$/,
    "",
  ),
  authLoginPopupUrl:
    process.env.AUTH_LOGIN_POPUP_URL || "https://login.continental-hub.com/popup.html",
  authTrustedLoginOrigins: String(
    process.env.AUTH_TRUSTED_LOGIN_ORIGINS || "",
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  baseUrl: (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, ""),
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.DISCORD_GUILD_ID,
  port: Number.parseInt(process.env.PORT || "3000", 10),
  sessionSecret: process.env.DISCORD_SESSION_SECRET,
  token: process.env.DISCORD_TOKEN,
};

config.authCompleteUrl = `${config.baseUrl}/auth/complete`;

module.exports = config;
