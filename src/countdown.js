const { ChannelType, PermissionFlagsBits } = require("discord.js");

const DEFAULT_DAILY_ALERT_TIME = "09:00";
const DEFAULT_DAILY_ALERT_TIME_ZONE = "UTC";
const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5];
const COMMON_DAILY_ALERT_TIME_ZONES = [
  "UTC",
  "Europe/Stockholm",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const SUPPORTED_DAILY_ALERT_TIME_ZONES = (
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : COMMON_DAILY_ALERT_TIME_ZONES
).filter(Boolean);
const supportedTimeZoneSet = new Set(SUPPORTED_DAILY_ALERT_TIME_ZONES);
const zonedDateFormatterCache = new Map();

const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sunday", shortLabel: "Sun" },
  { value: 1, label: "Monday", shortLabel: "Mon" },
  { value: 2, label: "Tuesday", shortLabel: "Tue" },
  { value: 3, label: "Wednesday", shortLabel: "Wed" },
  { value: 4, label: "Thursday", shortLabel: "Thu" },
  { value: 5, label: "Friday", shortLabel: "Fri" },
  { value: 6, label: "Saturday", shortLabel: "Sat" },
];

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  timeZone: "UTC",
  year: "numeric",
});

function normalizeCountdownMode(value) {
  return value === "active-days" ? "active-days" : "calendar";
}

function normalizeIsoDateInput(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  return parseIsoDate(raw) ? raw : "";
}

function normalizeWeekdaySelection(value) {
  const values = Array.isArray(value) ? value : [value];
  const weekdays = Array.from(
    new Set(
      values
        .map((entry) => Number.parseInt(String(entry), 10))
        .filter((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 6),
    ),
  ).sort((left, right) => left - right);

  return weekdays.length ? weekdays : [...DEFAULT_WEEKDAYS];
}

function normalizeCountdownAlertTime(value, fallback = DEFAULT_DAILY_ALERT_TIME) {
  const raw = String(value || "").trim();
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(raw) ? raw : fallback;
}

function normalizeCountdownAlertTimeZone(value, fallback = DEFAULT_DAILY_ALERT_TIME_ZONE) {
  const raw = String(value || "").trim();
  if (isValidTimeZone(raw)) {
    return raw;
  }

  return isValidTimeZone(fallback) ? fallback : DEFAULT_DAILY_ALERT_TIME_ZONE;
}

function normalizeExcludedDatesInput(value) {
  const tokens = String(value || "")
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return Array.from(
    new Set(tokens.map(normalizeIsoDateInput).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));
}

function clearCountdownSettings(settings = {}) {
  return {
    ...settings,
    countdownAlertChannelId: "",
    countdownAlertEnabled: false,
    countdownAlertTime: DEFAULT_DAILY_ALERT_TIME,
    countdownAlertTimeZone: DEFAULT_DAILY_ALERT_TIME_ZONE,
    countdownEnabled: false,
    countdownExcludedDates: [],
    countdownMode: "calendar",
    countdownTargetDate: "",
    countdownTitle: "",
    countdownWeekdays: [...DEFAULT_WEEKDAYS],
  };
}

function serializeWeekdays(value) {
  return JSON.stringify(normalizeWeekdaySelection(value));
}

function deserializeWeekdays(value) {
  if (!value) {
    return [...DEFAULT_WEEKDAYS];
  }

  try {
    return normalizeWeekdaySelection(JSON.parse(value));
  } catch {
    return normalizeWeekdaySelection(String(value).split(","));
  }
}

function serializeExcludedDates(value) {
  return JSON.stringify(normalizeExcludedDatesInput(Array.isArray(value) ? value.join("\n") : value));
}

function deserializeExcludedDates(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return normalizeExcludedDatesInput(Array.isArray(parsed) ? parsed.join("\n") : parsed);
  } catch {
    return normalizeExcludedDatesInput(value);
  }
}

function excludedDatesToTextarea(value) {
  return deserializeExcludedDates(Array.isArray(value) ? JSON.stringify(value) : value).join("\n");
}

function formatWeekdayList(weekdays) {
  const selected = new Set(normalizeWeekdaySelection(weekdays));
  return WEEKDAY_OPTIONS.filter((option) => selected.has(option.value))
    .map((option) => option.shortLabel)
    .join(", ");
}

function getCountdownResult(settings, options = {}) {
  const enabled = Boolean(settings.countdownEnabled);
  const title = String(settings.countdownTitle || "").trim();
  const targetDate = normalizeIsoDateInput(settings.countdownTargetDate);
  const mode = normalizeCountdownMode(settings.countdownMode);
  const weekdays = normalizeWeekdaySelection(settings.countdownWeekdays);
  const timeZone = normalizeCountdownAlertTimeZone(options.timeZone);
  const excludedDates = normalizeExcludedDatesInput(
    Array.isArray(settings.countdownExcludedDates)
      ? settings.countdownExcludedDates.join("\n")
      : settings.countdownExcludedDates,
  );

  if (!enabled) {
    return {
      commandPreview: "The countdown feature is disabled in this server.",
      configured: false,
      enabled,
      excludedDates,
      metaLine: "Turn the feature on to make /countdown available.",
      mode,
      modeLabel: mode === "calendar" ? "Calendar days" : "Selected weekdays",
      scheduleLine: "",
      state: "disabled",
      targetDate,
      targetDateLabel: "",
      title,
      weekdays,
    };
  }

  if (!title || !targetDate) {
    return {
      commandPreview: "This server's countdown is not fully configured yet.",
      configured: false,
      enabled,
      excludedDates,
      metaLine: "Add an event name and a target date to finish setup.",
      mode,
      modeLabel: mode === "calendar" ? "Calendar days" : "Selected weekdays",
      scheduleLine: buildScheduleLine(mode, weekdays, null, excludedDates.length),
      state: "incomplete",
      targetDate,
      targetDateLabel: targetDate ? formatDateLabel(targetDate) : "",
      title,
      weekdays,
    };
  }

  const today = getStartOfCurrentDate(options.now || new Date(), timeZone);
  const target = parseIsoDate(targetDate);
  const targetDateLabel = formatDateLabel(targetDate);
  const differenceInDays = getDayDifference(today, target);
  const activeDayBreakdown = mode === "active-days"
    ? analyzeActiveDayCountdown(today, target, weekdays, excludedDates)
    : null;

  if (differenceInDays < 0) {
    return {
      commandPreview: `${title} was on ${targetDateLabel}.`,
      configured: true,
      enabled,
      excludedDates,
      metaLine: "This countdown has already ended.",
      mode,
      modeLabel: mode === "calendar" ? "Calendar days" : "Selected weekdays",
      scheduleLine: buildScheduleLine(mode, weekdays, activeDayBreakdown),
      state: "past",
      targetDate,
      targetDateLabel,
      title,
      weekdays,
    };
  }

  if (differenceInDays === 0) {
    return {
      commandPreview: `${title} is happening today.`,
      configured: true,
      enabled,
      excludedDates,
      metaLine: `Target date: ${targetDateLabel}`,
      mode,
      modeLabel: mode === "calendar" ? "Calendar days" : "Selected weekdays",
      scheduleLine: buildScheduleLine(mode, weekdays, activeDayBreakdown),
      state: "today",
      targetDate,
      targetDateLabel,
      title,
      weekdays,
    };
  }

  const remaining = mode === "calendar"
    ? differenceInDays
    : activeDayBreakdown.remaining;
  const unitLabel = mode === "calendar"
    ? `calendar ${remaining === 1 ? "day" : "days"}`
    : `${remaining === 1 ? "selected day" : "selected days"}`;
  const scheduleLine = buildScheduleLine(mode, weekdays, activeDayBreakdown, excludedDates.length);
  const breakdownLine = buildBreakdownLine(mode, activeDayBreakdown);
  const ignoredExclusionsLine = buildIgnoredExclusionsLine(mode, activeDayBreakdown);

  return {
    commandPreview: [
      `${remaining} ${unitLabel} until ${title}`,
      `Target date: ${targetDateLabel}`,
      scheduleLine,
      breakdownLine,
      ignoredExclusionsLine,
    ]
      .filter(Boolean)
      .join("\n"),
    breakdownLine,
    configured: true,
    enabled,
    excludedDates,
    ignoredExclusionsLine,
    metaLine:
      mode === "calendar"
        ? "Every calendar day is included."
        : "Only selected weekdays after today and before the target date are counted. Excluded dates only reduce the total when they land on one of those counted days.",
    mode,
    modeLabel: mode === "calendar" ? "Calendar days" : "Selected weekdays",
    remaining,
    remainingLabel: `${remaining} ${unitLabel}`,
    scheduleLine,
    state: "upcoming",
    targetDate,
    targetDateLabel,
    title,
    weekdays,
  };
}

function getCountdownAlertState(settings, channelOptions = []) {
  if (!settings.countdownAlertEnabled) {
    return "disabled";
  }

  if (!settings.countdownEnabled || !settings.countdownTitle || !settings.countdownTargetDate) {
    return "incomplete";
  }

  if (!settings.countdownAlertChannelId) {
    return "incomplete";
  }

  if (
    channelOptions.length > 0 &&
    !channelOptions.some((channel) => channel.id === settings.countdownAlertChannelId)
  ) {
    return "incomplete";
  }

  return "live";
}

function getCountdownAlertStatusLabel(state) {
  if (state === "live") {
    return "Live";
  }

  if (state === "incomplete") {
    return "Needs setup";
  }

  return "Disabled";
}

function getCountdownAlertSummary(
  settings,
  channelOptions = [],
  countdown = getCountdownResult(settings, {
    timeZone: normalizeCountdownAlertTimeZone(settings.countdownAlertTimeZone),
  }),
) {
  const state = getCountdownAlertState(settings, channelOptions);
  const timing = getCountdownAlertTiming(settings);
  const channelLabel = getChannelLabel(settings.countdownAlertChannelId, channelOptions);

  return {
    channelLabel,
    note:
      state !== "live"
        ? "Pick a channel and time after the countdown itself is configured."
        : countdown.state === "past"
          ? "The event date has passed, so no further daily alerts will be sent."
          : "Blueprint posts this once per day after the selected local time until the event day arrives.",
    preview:
      state === "live"
        ? buildCountdownAlertMessage(settings, { countdown })
        : "Daily alerts stay off until the countdown module is enabled and fully configured.",
    state,
    timeHelpText: timing.timeHelpText,
    timeLabel: timing.timeLabel,
    timeZone: timing.timeZone,
    utcTimeLabel: timing.utcTimeLabel,
  };
}

function validateCountdownSettings(settings, guild, botMember) {
  if (!settings.countdownAlertEnabled) {
    return [];
  }

  if (!settings.countdownEnabled) {
    return ["Enable the countdown module before turning on daily countdown alerts."];
  }

  if (!settings.countdownTitle || !settings.countdownTargetDate) {
    return ["Add an event name and target date before enabling daily countdown alerts."];
  }

  if (!settings.countdownAlertChannelId) {
    return ["Select a countdown alert channel before enabling daily alerts."];
  }

  const channel = guild.channels.cache.get(settings.countdownAlertChannelId);
  if (!isCountdownAlertChannel(channel)) {
    return ["The selected countdown alert channel no longer exists or cannot receive messages."];
  }

  if (!botMember) {
    return ["Blueprint could not verify its bot permissions in this server."];
  }

  const permissions = channel.permissionsFor(botMember);
  if (
    !permissions ||
    !permissions.has(PermissionFlagsBits.ViewChannel) ||
    !permissions.has(PermissionFlagsBits.SendMessages)
  ) {
    return ["Blueprint needs View Channel and Send Messages in the selected countdown alert channel."];
  }

  return [];
}

function buildCountdownAlertMessage(
  settings,
  options = {},
) {
  const now = options.now || new Date();
  const countdown = options.countdown || getCountdownResult(settings, {
    now,
    timeZone: normalizeCountdownAlertTimeZone(settings.countdownAlertTimeZone),
  });

  if (countdown.state === "today") {
    return `${countdown.title} is happening today.\nTarget date: ${countdown.targetDateLabel}`;
  }

  if (countdown.state !== "upcoming") {
    return countdown.commandPreview;
  }

  const isoDate = getCurrentIsoDateInTimeZone(
    now,
    normalizeCountdownAlertTimeZone(settings.countdownAlertTimeZone),
  );
  return [
    `Daily countdown alert for ${formatDateLabel(isoDate)}`,
    countdown.commandPreview,
  ].join("\n");
}

function shouldSendCountdownAlert(settings, now, lastSentOn) {
  if (!settings.countdownAlertEnabled) {
    return false;
  }

  const timeZone = normalizeCountdownAlertTimeZone(settings.countdownAlertTimeZone);
  const countdown = getCountdownResult(settings, { now, timeZone });
  if (countdown.state !== "upcoming" && countdown.state !== "today") {
    return false;
  }

  if (!isCountdownAlertDay(settings, countdown, now)) {
    return false;
  }

  const today = getCurrentIsoDateInTimeZone(now, timeZone);
  if (lastSentOn === today) {
    return false;
  }

  const dueAt = getUtcDateForTimeZoneLocalTime(
    now,
    timeZone,
    normalizeCountdownAlertTime(settings.countdownAlertTime),
  );

  return dueAt ? now.getTime() >= dueAt.getTime() : false;
}

function isCountdownAlertDay(settings, countdown, now) {
  const timeZone = normalizeCountdownAlertTimeZone(settings.countdownAlertTimeZone);
  if (countdown.state === "today") {
    return true;
  }

  if (normalizeCountdownMode(settings.countdownMode) !== "active-days") {
    return true;
  }

  const isoDate = getCurrentIsoDateInTimeZone(now, timeZone);
  const excludedDates = new Set(
    normalizeExcludedDatesInput(
      Array.isArray(settings.countdownExcludedDates)
        ? settings.countdownExcludedDates.join("\n")
        : settings.countdownExcludedDates,
    ),
  );

  if (excludedDates.has(isoDate)) {
    return false;
  }

  const allowedWeekdays = new Set(normalizeWeekdaySelection(settings.countdownWeekdays));
  return allowedWeekdays.has(getIsoDateWeekday(isoDate));
}

function buildScheduleLine(mode, weekdays, activeDayBreakdown, enteredExcludedCount = 0) {
  if (mode !== "active-days") {
    return "";
  }

  const parts = [`Counting: ${formatWeekdayList(weekdays)}`];
  if (!activeDayBreakdown) {
    if (enteredExcludedCount > 0) {
      parts.push(`Entered exclusions: ${enteredExcludedCount} ${enteredExcludedCount === 1 ? "date" : "dates"}`);
    }

    return parts.join(" | ");
  }

  const effectiveExcludedCount = activeDayBreakdown?.effectiveExcludedCount || 0;
  const ignoredExcludedCount = activeDayBreakdown?.ignoredExcludedCount || 0;

  if (effectiveExcludedCount > 0) {
    parts.push(
      `Effective exclusions: ${effectiveExcludedCount} ${effectiveExcludedCount === 1 ? "date" : "dates"}`,
    );
  }

  if (ignoredExcludedCount > 0) {
    parts.push(
      `Ignored exclusions: ${ignoredExcludedCount} ${ignoredExcludedCount === 1 ? "date" : "dates"}`,
    );
  }

  return parts.join(" | ");
}

function parseIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10) === value ? parsed : null;
}

function isValidTimeZone(value) {
  if (!value) {
    return false;
  }

  if (supportedTimeZoneSet.has(value)) {
    return true;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function formatDateLabel(value) {
  const parsed = typeof value === "string" ? parseIsoDate(value) : value;
  return parsed ? dateFormatter.format(parsed) : "";
}

function startOfUtcDate(value) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function getStartOfCurrentDate(value, timeZone = DEFAULT_DAILY_ALERT_TIME_ZONE) {
  if (!timeZone || timeZone === "UTC") {
    return startOfUtcDate(value);
  }

  const isoDate = getCurrentIsoDateInTimeZone(value, timeZone);
  return parseIsoDate(isoDate) || startOfUtcDate(value);
}

function getDayDifference(start, end) {
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function addDays(date, amount) {
  return new Date(date.getTime() + amount * 86400000);
}

function getCountdownAlertTiming(settings, now = new Date()) {
  const timeZone = normalizeCountdownAlertTimeZone(settings.countdownAlertTimeZone);
  const localTimeLabel = normalizeCountdownAlertTime(settings.countdownAlertTime);
  const dueAtUtc = getUtcDateForTimeZoneLocalTime(now, timeZone, localTimeLabel);
  const utcTimeLabel = dueAtUtc
    ? formatTimeLabel(dueAtUtc.getUTCHours(), dueAtUtc.getUTCMinutes())
    : localTimeLabel;
  const timeLabel =
    timeZone === "UTC"
      ? `${utcTimeLabel} UTC`
      : `${localTimeLabel} ${timeZone} / ${utcTimeLabel} UTC`;
  const timeHelpText =
    timeZone === "UTC"
      ? `Posts daily at ${utcTimeLabel} UTC.`
      : `Posts daily at ${localTimeLabel} ${timeZone}, which is ${utcTimeLabel} UTC right now.`;

  return {
    localTimeLabel,
    timeHelpText,
    timeLabel,
    timeZone,
    utcTimeLabel,
  };
}

function analyzeActiveDayCountdown(today, target, weekdays, excludedDates) {
  const allowedWeekdays = new Set(normalizeWeekdaySelection(weekdays));
  const normalizedExcludedDates = normalizeExcludedDatesInput(excludedDates.join("\n"));
  const excluded = new Set(normalizedExcludedDates);
  const effectiveExcludedDates = [];
  const ignoredExcludedDates = [];
  let eligibleDayCount = 0;
  let remaining = 0;

  for (const isoDate of normalizedExcludedDates) {
    const reason = getIgnoredExclusionReason(isoDate, today, target, allowedWeekdays);
    if (reason) {
      ignoredExcludedDates.push({ isoDate, reason });
      continue;
    }

    effectiveExcludedDates.push(isoDate);
  }

  for (let cursor = addDays(today, 1); cursor < target; cursor = addDays(cursor, 1)) {
    const isoDate = cursor.toISOString().slice(0, 10);
    if (!allowedWeekdays.has(cursor.getUTCDay())) {
      continue;
    }

    eligibleDayCount += 1;

    if (excluded.has(isoDate)) {
      continue;
    }

    remaining += 1;
  }

  return {
    effectiveExcludedCount: effectiveExcludedDates.length,
    effectiveExcludedDates,
    eligibleDayCount,
    ignoredExcludedCount: ignoredExcludedDates.length,
    ignoredExcludedDates,
    remaining,
  };
}

function buildBreakdownLine(mode, activeDayBreakdown) {
  if (mode !== "active-days" || !activeDayBreakdown) {
    return "";
  }

  const { eligibleDayCount, effectiveExcludedCount, remaining } = activeDayBreakdown;
  return `Weekdays in range: ${eligibleDayCount} | Removed by exclusions: ${effectiveExcludedCount} | Final countdown: ${remaining}`;
}

function buildIgnoredExclusionsLine(mode, activeDayBreakdown) {
  if (mode !== "active-days" || !activeDayBreakdown || activeDayBreakdown.ignoredExcludedCount === 0) {
    return "";
  }

  const summarizedDates = activeDayBreakdown.ignoredExcludedDates
    .slice(0, 3)
    .map(({ isoDate, reason }) => `${isoDate} (${reason})`)
    .join(", ");
  const remainingCount = activeDayBreakdown.ignoredExcludedCount - 3;
  const suffix = remainingCount > 0 ? `, plus ${remainingCount} more` : "";

  return `Ignored excluded dates: ${summarizedDates}${suffix}`;
}

function getCurrentIsoDateInTimeZone(value, timeZone) {
  const parts = getZonedDateParts(value, normalizeCountdownAlertTimeZone(timeZone));
  return `${parts.year}-${padNumber(parts.month)}-${padNumber(parts.day)}`;
}

function getUtcDateForTimeZoneLocalTime(referenceDate, timeZone, timeLabel) {
  const [hours, minutes] = normalizeCountdownAlertTime(timeLabel).split(":");
  const parts = getZonedDateParts(referenceDate, timeZone);
  const desiredAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    Number.parseInt(hours, 10),
    Number.parseInt(minutes, 10),
  );

  let guess = new Date(desiredAsUtc);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const guessParts = getZonedDateParts(guess, timeZone);
    const actualAsUtc = Date.UTC(
      guessParts.year,
      guessParts.month - 1,
      guessParts.day,
      guessParts.hour,
      guessParts.minute,
    );
    const delta = desiredAsUtc - actualAsUtc;
    if (delta === 0) {
      break;
    }

    guess = new Date(guess.getTime() + delta);
  }

  return guess;
}

function getIsoDateWeekday(isoDate) {
  return parseIsoDate(isoDate)?.getUTCDay() ?? -1;
}

function getZonedDateFormatter(timeZone) {
  if (!zonedDateFormatterCache.has(timeZone)) {
    zonedDateFormatterCache.set(
      timeZone,
      new Intl.DateTimeFormat("en-CA", {
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23",
        minute: "2-digit",
        month: "2-digit",
        timeZone,
        year: "numeric",
      }),
    );
  }

  return zonedDateFormatterCache.get(timeZone);
}

function getZonedDateParts(value, timeZone) {
  const formatted = getZonedDateFormatter(timeZone).formatToParts(value);
  const mapped = Object.fromEntries(
    formatted
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    day: Number.parseInt(mapped.day, 10),
    hour: Number.parseInt(mapped.hour, 10),
    minute: Number.parseInt(mapped.minute, 10),
    month: Number.parseInt(mapped.month, 10),
    year: Number.parseInt(mapped.year, 10),
  };
}

function formatTimeLabel(hours, minutes) {
  return `${padNumber(hours)}:${padNumber(minutes)}`;
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function getIgnoredExclusionReason(isoDate, today, target, allowedWeekdays) {
  const excludedDate = parseIsoDate(isoDate);
  if (!excludedDate) {
    return "invalid date";
  }

  if (excludedDate <= today) {
    return "on or before today";
  }

  if (excludedDate >= target) {
    return "on or after target date";
  }

  if (!allowedWeekdays.has(excludedDate.getUTCDay())) {
    return "weekday not selected";
  }

  return "";
}

module.exports = {
  analyzeActiveDayCountdown,
  clearCountdownSettings,
  DEFAULT_DAILY_ALERT_TIME,
  DEFAULT_DAILY_ALERT_TIME_ZONE,
  DEFAULT_WEEKDAYS,
  COMMON_DAILY_ALERT_TIME_ZONES,
  SUPPORTED_DAILY_ALERT_TIME_ZONES,
  WEEKDAY_OPTIONS,
  buildCountdownAlertMessage,
  deserializeExcludedDates,
  deserializeWeekdays,
  excludedDatesToTextarea,
  formatDateLabel,
  formatWeekdayList,
  getCountdownAlertState,
  getCountdownAlertStatusLabel,
  getCountdownAlertSummary,
  getCountdownResult,
  getCurrentIsoDateInTimeZone,
  isCountdownAlertDay,
  normalizeCountdownAlertTime,
  normalizeCountdownAlertTimeZone,
  normalizeCountdownMode,
  normalizeExcludedDatesInput,
  normalizeIsoDateInput,
  normalizeWeekdaySelection,
  serializeExcludedDates,
  serializeWeekdays,
  shouldSendCountdownAlert,
  validateCountdownSettings,
};

function getChannelLabel(channelId, channelOptions) {
  if (!channelId) {
    return "Not selected";
  }

  return channelOptions.find((channel) => channel.id === channelId)?.label || "Unavailable";
}

function isCountdownAlertChannel(channel) {
  return (
    channel &&
    (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)
  );
}
