const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5];

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

function normalizeExcludedDatesInput(value) {
  const tokens = String(value || "")
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return Array.from(
    new Set(tokens.map(normalizeIsoDateInput).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));
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
      scheduleLine: buildScheduleLine(mode, weekdays, excludedDates.length),
      state: "incomplete",
      targetDate,
      targetDateLabel: targetDate ? formatDateLabel(targetDate) : "",
      title,
      weekdays,
    };
  }

  const today = startOfUtcDate(options.now || new Date());
  const target = parseIsoDate(targetDate);
  const targetDateLabel = formatDateLabel(targetDate);
  const differenceInDays = getDayDifference(today, target);

  if (differenceInDays < 0) {
    return {
      commandPreview: `${title} was on ${targetDateLabel}.`,
      configured: true,
      enabled,
      excludedDates,
      metaLine: "This countdown has already ended.",
      mode,
      modeLabel: mode === "calendar" ? "Calendar days" : "Selected weekdays",
      scheduleLine: buildScheduleLine(mode, weekdays, excludedDates.length),
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
      scheduleLine: buildScheduleLine(mode, weekdays, excludedDates.length),
      state: "today",
      targetDate,
      targetDateLabel,
      title,
      weekdays,
    };
  }

  const remaining = mode === "calendar"
    ? differenceInDays
    : countActiveDaysUntilTarget(today, target, weekdays, excludedDates);
  const unitLabel = mode === "calendar"
    ? `calendar ${remaining === 1 ? "day" : "days"}`
    : `${remaining === 1 ? "selected day" : "selected days"}`;

  return {
    commandPreview: [
      `${remaining} ${unitLabel} until ${title}`,
      `Target date: ${targetDateLabel}`,
      buildScheduleLine(mode, weekdays, excludedDates.length),
    ]
      .filter(Boolean)
      .join("\n"),
    configured: true,
    enabled,
    excludedDates,
    metaLine:
      mode === "calendar"
        ? "Every calendar day is included."
        : "Only matching weekdays before the target date are counted.",
    mode,
    modeLabel: mode === "calendar" ? "Calendar days" : "Selected weekdays",
    remaining,
    remainingLabel: `${remaining} ${unitLabel}`,
    scheduleLine: buildScheduleLine(mode, weekdays, excludedDates.length),
    state: "upcoming",
    targetDate,
    targetDateLabel,
    title,
    weekdays,
  };
}

function buildScheduleLine(mode, weekdays, excludedCount) {
  if (mode !== "active-days") {
    return "";
  }

  const parts = [`Counting: ${formatWeekdayList(weekdays)}`];
  if (excludedCount > 0) {
    parts.push(`Skipping ${excludedCount} excluded ${excludedCount === 1 ? "date" : "dates"}`);
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

function formatDateLabel(value) {
  const parsed = typeof value === "string" ? parseIsoDate(value) : value;
  return parsed ? dateFormatter.format(parsed) : "";
}

function startOfUtcDate(value) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function getDayDifference(start, end) {
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function addDays(date, amount) {
  return new Date(date.getTime() + amount * 86400000);
}

function countActiveDaysUntilTarget(today, target, weekdays, excludedDates) {
  const allowedWeekdays = new Set(normalizeWeekdaySelection(weekdays));
  const excluded = new Set(normalizeExcludedDatesInput(excludedDates.join("\n")));
  let total = 0;

  for (let cursor = addDays(today, 1); cursor < target; cursor = addDays(cursor, 1)) {
    const isoDate = cursor.toISOString().slice(0, 10);
    if (!allowedWeekdays.has(cursor.getUTCDay()) || excluded.has(isoDate)) {
      continue;
    }

    total += 1;
  }

  return total;
}

module.exports = {
  DEFAULT_WEEKDAYS,
  WEEKDAY_OPTIONS,
  deserializeExcludedDates,
  deserializeWeekdays,
  excludedDatesToTextarea,
  formatDateLabel,
  formatWeekdayList,
  getCountdownResult,
  normalizeCountdownMode,
  normalizeExcludedDatesInput,
  normalizeIsoDateInput,
  normalizeWeekdaySelection,
  serializeExcludedDates,
  serializeWeekdays,
};
