const test = require("node:test");
const assert = require("node:assert/strict");

const {
  analyzeActiveDayCountdown,
  clearCountdownSettings,
  getCountdownAlertSummary,
  getCountdownResult,
  shouldSendCountdownAlert,
} = require("../src/countdown");

test("active-day analysis separates effective and ignored exclusions", () => {
  const today = new Date("2026-04-13T00:00:00Z");
  const target = new Date("2026-04-23T00:00:00Z");
  const breakdown = analyzeActiveDayCountdown(
    today,
    target,
    [1, 2, 3, 4, 5],
    ["2026-04-15", "2026-04-18", "2026-04-21", "2026-04-23", "2026-04-13"],
  );

  assert.equal(breakdown.eligibleDayCount, 7);
  assert.equal(breakdown.remaining, 5);
  assert.deepEqual(breakdown.effectiveExcludedDates, ["2026-04-15", "2026-04-21"]);
  assert.deepEqual(breakdown.ignoredExcludedDates, [
    { isoDate: "2026-04-13", reason: "on or before today" },
    { isoDate: "2026-04-18", reason: "weekday not selected" },
    { isoDate: "2026-04-23", reason: "on or after target date" },
  ]);
});

test("countdown preview explains the final weekday count", () => {
  const result = getCountdownResult(
    {
      countdownEnabled: true,
      countdownExcludedDates: [
        "2026-04-15",
        "2026-04-18",
        "2026-04-21",
        "2026-04-23",
        "2026-04-13",
      ],
      countdownMode: "active-days",
      countdownTargetDate: "2026-04-23",
      countdownTitle: "Launch Day",
      countdownWeekdays: [1, 2, 3, 4, 5],
    },
    { now: new Date("2026-04-13T12:00:00Z") },
  );

  assert.equal(result.remaining, 5);
  assert.equal(
    result.scheduleLine,
    "Counting: Mon, Tue, Wed, Thu, Fri | Effective exclusions: 2 dates | Ignored exclusions: 3 dates",
  );
  assert.equal(
    result.breakdownLine,
    "Weekdays in range: 7 | Removed by exclusions: 2 | Final countdown: 5",
  );
  assert.equal(
    result.ignoredExclusionsLine,
    "Ignored excluded dates: 2026-04-13 (on or before today), 2026-04-18 (weekday not selected), 2026-04-23 (on or after target date)",
  );
  assert.match(result.commandPreview, /^5 selected days until Launch Day/m);
});

test("incomplete countdown keeps entered exclusions visible without overstating their effect", () => {
  const result = getCountdownResult({
    countdownEnabled: true,
    countdownExcludedDates: ["2026-04-15", "2026-04-21"],
    countdownMode: "active-days",
    countdownTargetDate: "",
    countdownTitle: "Launch Day",
    countdownWeekdays: [1, 2, 3, 4, 5],
  });

  assert.equal(result.state, "incomplete");
  assert.equal(
    result.scheduleLine,
    "Counting: Mon, Tue, Wed, Thu, Fri | Entered exclusions: 2 dates",
  );
});

test("clearing countdown settings preserves other modules", () => {
  const cleared = clearCountdownSettings({
    autoRoleEnabled: true,
    countdownAlertChannelId: "123456789012345678",
    countdownAlertEnabled: true,
    countdownAlertTime: "17:30",
    countdownEnabled: true,
    countdownExcludedDates: ["2026-04-15"],
    countdownMode: "active-days",
    countdownTargetDate: "2026-06-10",
    countdownTitle: "Summer break",
    countdownWeekdays: [1, 2, 3, 4],
    helloEnabled: true,
    pingResponse: "Pong.",
  });

  assert.equal(cleared.countdownEnabled, false);
  assert.equal(cleared.countdownTitle, "");
  assert.equal(cleared.countdownTargetDate, "");
  assert.equal(cleared.countdownMode, "calendar");
  assert.deepEqual(cleared.countdownWeekdays, [1, 2, 3, 4, 5]);
  assert.deepEqual(cleared.countdownExcludedDates, []);
  assert.equal(cleared.countdownAlertEnabled, false);
  assert.equal(cleared.countdownAlertChannelId, "");
  assert.equal(cleared.countdownAlertTime, "09:00");
  assert.equal(cleared.countdownAlertTimeZone, "UTC");
  assert.equal(cleared.autoRoleEnabled, true);
  assert.equal(cleared.helloEnabled, true);
  assert.equal(cleared.pingResponse, "Pong.");
});

test("active-day alerts only send on days that decrement the countdown", () => {
  const settings = {
    countdownAlertEnabled: true,
    countdownAlertTime: "09:00",
    countdownEnabled: true,
    countdownExcludedDates: ["2026-04-15"],
    countdownMode: "active-days",
    countdownTargetDate: "2026-04-20",
    countdownTitle: "Launch Day",
    countdownWeekdays: [1, 2, 3, 4, 5],
  };

  assert.equal(
    shouldSendCountdownAlert(settings, new Date("2026-04-14T09:30:00Z"), null),
    true,
  );
  assert.equal(
    shouldSendCountdownAlert(settings, new Date("2026-04-15T09:30:00Z"), null),
    false,
  );
  assert.equal(
    shouldSendCountdownAlert(settings, new Date("2026-04-18T09:30:00Z"), null),
    false,
  );
});

test("countdown alerts still send on the target day", () => {
  const settings = {
    countdownAlertEnabled: true,
    countdownAlertTime: "09:00",
    countdownEnabled: true,
    countdownExcludedDates: [],
    countdownMode: "active-days",
    countdownTargetDate: "2026-04-20",
    countdownTitle: "Launch Day",
    countdownWeekdays: [1, 2, 3, 4, 5],
  };

  assert.equal(
    shouldSendCountdownAlert(settings, new Date("2026-04-20T09:30:00Z"), null),
    true,
  );
});

test("countdown alert scheduling follows the configured local time zone", () => {
  const settings = {
    countdownAlertEnabled: true,
    countdownAlertTime: "09:00",
    countdownAlertTimeZone: "Europe/Stockholm",
    countdownEnabled: true,
    countdownExcludedDates: [],
    countdownMode: "calendar",
    countdownTargetDate: "2026-04-20",
    countdownTitle: "Launch Day",
    countdownWeekdays: [1, 2, 3, 4, 5],
  };

  assert.equal(
    shouldSendCountdownAlert(settings, new Date("2026-04-14T06:30:00Z"), null),
    false,
  );
  assert.equal(
    shouldSendCountdownAlert(settings, new Date("2026-04-14T07:05:00Z"), null),
    true,
  );
  assert.equal(
    shouldSendCountdownAlert(settings, new Date("2026-04-14T07:05:00Z"), "2026-04-14"),
    false,
  );
});

test("countdown alert summary shows local and UTC time together", () => {
  const summary = getCountdownAlertSummary(
    {
      countdownAlertChannelId: "123",
      countdownAlertEnabled: true,
      countdownAlertTime: "09:00",
      countdownAlertTimeZone: "Europe/Stockholm",
      countdownEnabled: true,
      countdownTargetDate: "2026-04-20",
      countdownTitle: "Launch Day",
    },
    [{ id: "123", label: "#announcements" }],
  );

  assert.equal(summary.channelLabel, "#announcements");
  assert.match(summary.timeLabel, /^09:00 Europe\/Stockholm \/ \d{2}:\d{2} UTC$/);
  assert.match(summary.timeHelpText, /Europe\/Stockholm/);
});
