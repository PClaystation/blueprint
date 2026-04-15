(function () {
  const config = window.BLUEPRINT_AUTH || {};
  const trustedLoginOrigins = new Set(config.trustedLoginOrigins || []);
  const currentPath = `${window.location.pathname}${window.location.search}`;
  const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5];
  const dateLabelFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
    year: "numeric",
  });
  const zonedFormatterCache = new Map();

  function safeText(value) {
    return String(value || "").trim();
  }

  function isTrustedLoginOrigin(origin) {
    return trustedLoginOrigins.has(origin);
  }

  function getModuleStateStorageKey() {
    return `blueprint:module-card-state:${window.location.pathname}`;
  }

  function buildAuthCompleteUrl(returnTo) {
    const url = new URL(config.authCompleteUrl || `${window.location.origin}/auth/complete`);
    url.searchParams.set("returnTo", returnTo || "/dashboard");
    return url.toString();
  }

  function buildLoginPopupUrl(returnTo) {
    const popupUrl = new URL(config.authLoginPopupUrl);
    popupUrl.searchParams.set("origin", window.location.origin);
    popupUrl.searchParams.set("redirect", buildAuthCompleteUrl(returnTo));
    popupUrl.searchParams.set("apiBaseUrl", config.authApiBaseUrl);
    return popupUrl.toString();
  }

  async function syncLocalSession(accessToken) {
    const response = await fetch("/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accessToken }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || "Could not sync your session.");
    }

    return response.json();
  }

  async function refreshDashboardAuth() {
    const response = await fetch(`${config.authApiBaseUrl}/api/auth/refresh_token`, {
      method: "POST",
      credentials: "include",
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || "Could not refresh your Dashboard session.");
    }

    const accessToken = safeText(payload.accessToken || payload.token);
    if (!accessToken) {
      throw new Error(payload.message || "No active Dashboard session was found.");
    }

    return accessToken;
  }

  async function syncFromDashboard(returnTo, options) {
    const redirect = !options || options.redirect !== false;
    const accessToken = await refreshDashboardAuth();
    await syncLocalSession(accessToken);
    if (redirect) {
      window.location.href = returnTo || "/dashboard";
    }
  }

  function openLogin(returnTo) {
    const url = buildLoginPopupUrl(returnTo);
    const popup = window.open(
      url,
      "ContinentalIdLogin",
      "popup=yes,width=520,height=760,resizable=yes,scrollbars=yes",
    );

    if (!popup) {
      window.location.href = url;
      return;
    }

    popup.focus();
  }

  async function startDiscordLink(returnTo, button) {
    if (button) {
      button.disabled = true;
    }

    try {
      const response = await fetch("/auth/link/discord/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ returnTo }),
      });

      if (response.status === 401) {
        await syncFromDashboard(returnTo, { redirect: false });
        await startDiscordLink(returnTo, button);
        return;
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.url) {
        throw new Error(payload.message || "Could not start Discord linking.");
      }

      const popup = window.open(
        payload.url,
        "ContinentalIdDiscordLink",
        "popup=yes,width=520,height=760,resizable=yes,scrollbars=yes",
      );

      if (!popup) {
        window.location.href = payload.url;
        return;
      }

      popup.focus();
    } catch (error) {
      window.alert(error.message || "Could not start Discord linking.");
    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  }

  function bindLoginButtons() {
    document.querySelectorAll("#login-button, #relogin-button").forEach((button) => {
      button.addEventListener("click", () => openLogin(currentPath));
    });
  }

  function bindLinkDiscordButton() {
    const button = document.getElementById("connect-discord-button");
    if (!button) {
      return;
    }

    button.addEventListener("click", () => {
      startDiscordLink(currentPath, button);
    });
  }

  function bindCountdownControls() {
    const modeSelect = document.querySelector("[data-countdown-mode]");
    const scheduleFields = document.querySelector("[data-countdown-schedule-fields]");
    const modeCopy = document.querySelector("[data-countdown-mode-copy]");
    const alertToggle = document.querySelector("input[name='countdownAlertEnabled']");
    const alertFields = document.querySelector("[data-countdown-alert-fields]");

    if (!modeSelect || !scheduleFields || !modeCopy) {
      return;
    }

    const modeDescriptions = {
      "active-days":
        "Count only selected weekdays after today and before the target date. Excluded dates only reduce the countdown when they fall on one of those counted days.",
      calendar: "Count every calendar day from today to the target date.",
    };

    function syncCountdownMode() {
      const mode = safeText(modeSelect.value) || "calendar";
      scheduleFields.classList.toggle("is-hidden", mode !== "active-days");
      modeCopy.textContent = modeDescriptions[mode] || modeDescriptions.calendar;
    }

    modeSelect.addEventListener("change", syncCountdownMode);
    syncCountdownMode();

    if (alertToggle && alertFields) {
      function syncCountdownAlerts() {
        alertFields.classList.toggle("is-hidden", !alertToggle.checked);
      }

      alertToggle.addEventListener("change", syncCountdownAlerts);
      syncCountdownAlerts();
    }
  }

  function bindGuildSearchControls() {
    const searchInput = document.querySelector("[data-guild-search]");
    const attentionToggle = document.querySelector("[data-guild-attention-filter]");
    const cards = Array.from(document.querySelectorAll("[data-guild-card]"));
    const emptyState = document.querySelector("[data-guild-search-empty]");

    if (!searchInput || cards.length === 0) {
      return;
    }

    function syncVisibleCards() {
      const query = safeText(searchInput.value).toLowerCase();
      const attentionOnly = Boolean(attentionToggle && attentionToggle.checked);
      let visibleCount = 0;

      cards.forEach((card) => {
        const name = safeText(card.getAttribute("data-guild-name")).toLowerCase();
        const hasAttention = safeText(card.getAttribute("data-guild-attention")) === "true";
        const matchesQuery = !query || name.includes(query);
        const matchesAttention = !attentionOnly || hasAttention;
        const visible = matchesQuery && matchesAttention;

        card.classList.toggle("is-hidden", !visible);
        if (visible) {
          visibleCount += 1;
        }
      });

      if (emptyState) {
        emptyState.classList.toggle("is-hidden", visibleCount > 0);
      }
    }

    searchInput.addEventListener("input", syncVisibleCards);
    if (attentionToggle) {
      attentionToggle.addEventListener("change", syncVisibleCards);
    }
    syncVisibleCards();
  }

  function bindModuleCards() {
    const cards = Array.from(document.querySelectorAll("[data-module-card]"));
    if (cards.length === 0) {
      return;
    }

    let savedStates = {};
    try {
      savedStates = JSON.parse(window.localStorage.getItem(getModuleStateStorageKey()) || "{}");
    } catch {
      savedStates = {};
    }

    function persistStates() {
      try {
        window.localStorage.setItem(getModuleStateStorageKey(), JSON.stringify(savedStates));
      } catch {
        // Ignore storage failures so the collapse UI still works without persistence.
      }
    }

    function syncCard(card, open) {
      const button = card.querySelector("[data-module-trigger]");
      const panel = card.querySelector("[data-module-panel]");
      if (!button || !panel) {
        return;
      }

      card.classList.toggle("is-open", open);
      button.setAttribute("aria-expanded", open ? "true" : "false");
      panel.setAttribute("aria-hidden", open ? "false" : "true");
      panel.inert = !open;
    }

    cards.forEach((card) => {
      const moduleId = safeText(card.getAttribute("data-module-id"));
      const defaultOpen = safeText(card.getAttribute("data-module-default-open")) === "true";
      const button = card.querySelector("[data-module-trigger]");
      if (!moduleId || !button) {
        return;
      }

      const initialOpen =
        typeof savedStates[moduleId] === "boolean" ? savedStates[moduleId] : defaultOpen;
      syncCard(card, initialOpen);

      button.addEventListener("click", () => {
        const nextOpen = !card.classList.contains("is-open");
        savedStates[moduleId] = nextOpen;
        syncCard(card, nextOpen);
        persistStates();
      });
    });
  }

  function bindSettingsFormUX() {
    const form = document.querySelector("[data-settings-form]");
    if (!form) {
      return;
    }

    const saveBar = form.querySelector("[data-save-bar]");
    const saveButton = form.querySelector("[data-save-button]");
    const discardButton = form.querySelector("[data-discard-button]");
    const saveTitle = form.querySelector("[data-save-title]");
    const saveStatus = form.querySelector("[data-save-status]");
    const validationSummary = document.querySelector("[data-validation-summary]");
    const validationList = document.querySelector("[data-validation-list]");
    const overviewEnabled = document.querySelector("[data-overview-enabled]");
    const overviewAttention = document.querySelector("[data-overview-attention]");
    const overviewHello = document.querySelector("[data-overview-hello]");
    const countdownAlertStatus = document.querySelector("[data-countdown-alert-status]");
    const countdownPreviewNode = form.querySelector("[data-countdown-preview]");
    const countdownModeLabel = form.querySelector("[data-countdown-mode-label]");
    const countdownStatusLabel = form.querySelector("[data-countdown-status-label]");
    const countdownTargetLabel = form.querySelector("[data-countdown-target-label]");
    const countdownMetaLine = form.querySelector("[data-countdown-meta-line]");
    const countdownScheduleLine = form.querySelector("[data-countdown-schedule-line]");
    const countdownBreakdownLine = form.querySelector("[data-countdown-breakdown-line]");
    const countdownIgnoredLine = form.querySelector("[data-countdown-ignored-line]");
    const countdownAlertPreviewNode = form.querySelector("[data-countdown-alert-preview]");
    const countdownAlertChannelLabel = form.querySelector("[data-countdown-alert-channel-label]");
    const countdownAlertTimeLabel = form.querySelector("[data-countdown-alert-time-label]");
    const countdownAlertNote = form.querySelector("[data-countdown-alert-note]");
    const countdownAlertTimeCopy = form.querySelector("[data-countdown-alert-time-copy]");
    const excludedDatesHidden = form.querySelector("[data-excluded-dates-hidden]");
    const excludedDateInput = form.querySelector("[data-excluded-date-input]");
    const excludedDateAddButton = form.querySelector("[data-excluded-date-add]");
    const excludedDateList = form.querySelector("[data-excluded-date-list]");
    const excludedDateEmpty = form.querySelector("[data-excluded-date-empty]");

    const statusLabels = {
      autoRole: {
        disabled: "Disabled",
        incomplete: "Needs setup",
        live: "Live",
      },
      countdown: {
        disabled: "Disabled",
        ended: "Ended",
        incomplete: "Needs setup",
        live: "Live",
        today: "Today",
      },
      welcome: {
        disabled: "Disabled",
        incomplete: "Needs setup",
        live: "Live",
      },
    };
    let initialSnapshot = serializeForm(form);
    let isDirty = false;

    function getField(name) {
      return form.elements.namedItem(name);
    }

    function getValue(name) {
      const field = getField(name);
      return field ? safeText(field.value) : "";
    }

    function isChecked(name) {
      const field = getField(name);
      return Boolean(field && field.checked);
    }

    function getValues(name) {
      const field = getField(name);
      if (!field) {
        return [];
      }

      if (typeof field.length === "number" && typeof field.item === "function") {
        return Array.from(field)
          .filter((item) => item && item.checked)
          .map((item) => safeText(item.value))
          .filter(Boolean);
      }

      const value = safeText(field.value);
      return value ? [value] : [];
    }

    function getSelectedOptionLabel(name, fallback) {
      const field = getField(name);
      if (!field || !field.selectedOptions || !field.selectedOptions[0]) {
        return fallback;
      }

      return safeText(field.selectedOptions[0].textContent) || fallback;
    }

    function getExcludedDates() {
      return normalizeExcludedDatesValue(excludedDatesHidden ? excludedDatesHidden.value : "");
    }

    function renderExcludedDates() {
      if (!excludedDateList || !excludedDateEmpty || !excludedDatesHidden) {
        return;
      }

      const dates = getExcludedDates();
      excludedDateList.innerHTML = renderExcludedDateChips(dates);
      excludedDateList.classList.toggle("is-hidden", dates.length === 0);
      excludedDateEmpty.classList.toggle("is-hidden", dates.length > 0);
    }

    function setExcludedDates(dates, dispatchEvents = true) {
      if (!excludedDatesHidden) {
        return;
      }

      excludedDatesHidden.value = dates.join(",");
      renderExcludedDates();

      if (!dispatchEvents) {
        return;
      }

      excludedDatesHidden.dispatchEvent(new Event("input", { bubbles: true }));
      excludedDatesHidden.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function addExcludedDate() {
      if (!excludedDateInput) {
        return;
      }

      const value = normalizeIsoDateInput(excludedDateInput.value);
      if (!value) {
        excludedDateInput.focus();
        return;
      }

      const dates = Array.from(new Set([...getExcludedDates(), value])).sort();
      excludedDateInput.value = "";
      setExcludedDates(dates);
    }

    function getDashboardState() {
      const countdownData = {
        alertChannelId: getValue("countdownAlertChannelId"),
        alertChannelLabel: getSelectedOptionLabel("countdownAlertChannelId", "Not selected"),
        alertEnabled: isChecked("countdownAlertEnabled"),
        alertTime: normalizeCountdownAlertTime(getValue("countdownAlertTime")),
        alertTimeZone: normalizeCountdownAlertTimeZone(getValue("countdownAlertTimeZone")),
        enabled: isChecked("countdownEnabled"),
        excludedDates: getExcludedDates(),
        mode: normalizeCountdownMode(getValue("countdownMode")),
        targetDate: normalizeIsoDateInput(getValue("countdownTargetDate")),
        title: getValue("countdownTitle"),
        weekdays: normalizeWeekdaySelection(getValues("countdownWeekdays")),
      };
      const countdownPreview = calculateCountdownPreview(countdownData);
      const countdownAlertPreview = calculateCountdownAlertPreview(
        countdownData,
        countdownPreview,
      );
      const welcomeEnabled = isChecked("welcomeEnabled");
      const autoRoleEnabled = isChecked("autoRoleEnabled");
      const welcomeChannelId = getValue("welcomeChannelId");
      const welcomeMessage = getValue("welcomeMessageTemplate");
      const autoRoleRoleId = getValue("autoRoleRoleId");
      const modules = {
        countdown: {
          blocker: "",
          enabled: countdownData.enabled,
          state: "disabled",
        },
        welcome: {
          blocker: "",
          enabled: welcomeEnabled,
          state: "disabled",
        },
        autoRole: {
          blocker: "",
          enabled: autoRoleEnabled,
          state: "disabled",
        },
      };

      if (countdownData.enabled) {
        modules.countdown.state = mapCountdownStateToStatus(countdownPreview.state);
        if (!countdownData.title || !countdownData.targetDate) {
          modules.countdown.blocker = "Add an event name and target date to finish setup.";
          modules.countdown.state = "incomplete";
        } else if (countdownData.alertEnabled && !countdownData.alertChannelId) {
          modules.countdown.blocker = "Select a countdown alert channel before enabling daily alerts.";
          modules.countdown.state = "incomplete";
        }
      }

      if (welcomeEnabled) {
        modules.welcome.state = "live";
        if (!welcomeChannelId) {
          modules.welcome.blocker = "Choose a welcome channel to finish setup.";
          modules.welcome.state = "incomplete";
        } else if (!welcomeMessage) {
          modules.welcome.blocker = "Add a welcome message to finish setup.";
          modules.welcome.state = "incomplete";
        }
      }

      if (autoRoleEnabled) {
        modules.autoRole.state = "live";
        if (!autoRoleRoleId) {
          modules.autoRole.blocker = "Select a default role to finish setup.";
          modules.autoRole.state = "incomplete";
        }
      }

      const enabledModules = Object.values(modules).filter((module) => module.enabled).length;
      const attentionModules = Object.values(modules).filter(
        (module) => module.enabled && module.state === "incomplete",
      ).length;

      return {
        attentionModules,
        countdownAlertPreview,
        countdownPreview,
        enabledModules,
        helloEnabled: isChecked("helloEnabled"),
        modules,
      };
    }

    function syncStatusPill(key, state) {
      const target = document.querySelector(`[data-status-target="${key}"]`);
      if (!target) {
        return;
      }

      target.className = `status-pill status-pill-${state}`;
      target.textContent = statusLabels[key][state];
    }

    function syncValidationSummary(moduleState) {
      if (!validationSummary || !validationList) {
        return;
      }

      const items = [];
      if (moduleState.modules.countdown.blocker) {
        items.push(`<li><strong>Countdown:</strong> ${escapeHtml(moduleState.modules.countdown.blocker)}</li>`);
      }
      if (moduleState.modules.welcome.blocker) {
        items.push(`<li><strong>Welcome:</strong> ${escapeHtml(moduleState.modules.welcome.blocker)}</li>`);
      }
      if (moduleState.modules.autoRole.blocker) {
        items.push(`<li><strong>Auto role:</strong> ${escapeHtml(moduleState.modules.autoRole.blocker)}</li>`);
      }

      validationList.innerHTML = items.join("");
      validationSummary.classList.toggle("is-hidden", items.length === 0);
    }

    function syncModuleDiagnostics(moduleState) {
      Object.entries(moduleState.modules).forEach(([key, module]) => {
        const blocker = document.querySelector(`[data-module-blocker="${key}"]`);
        if (blocker) {
          blocker.textContent = module.blocker;
          blocker.classList.toggle("is-hidden", !module.blocker);
        }

        syncStatusPill(key, module.state);
      });

      if (overviewEnabled) {
        overviewEnabled.textContent = String(moduleState.enabledModules);
      }
      if (overviewAttention) {
        overviewAttention.textContent = String(moduleState.attentionModules);
      }
      if (overviewHello) {
        overviewHello.textContent = moduleState.helloEnabled ? "Live" : "Disabled";
      }

      syncValidationSummary(moduleState);
    }

    function syncCountdownPreview(previewState) {
      if (countdownPreviewNode) {
        countdownPreviewNode.innerHTML = escapeHtml(previewState.countdownPreview.commandPreview)
          .replaceAll("\n", "<br />");
      }
      if (countdownModeLabel) {
        countdownModeLabel.textContent = previewState.countdownPreview.modeLabel;
      }
      if (countdownStatusLabel) {
        countdownStatusLabel.textContent = getCountdownStatusLabel(previewState.countdownPreview.state);
      }
      if (countdownTargetLabel) {
        countdownTargetLabel.textContent = previewState.countdownPreview.targetDateLabel || "Not set";
      }
      if (countdownMetaLine) {
        countdownMetaLine.textContent = previewState.countdownPreview.metaLine;
      }

      syncOptionalPreviewLine(countdownScheduleLine, previewState.countdownPreview.scheduleLine);
      syncOptionalPreviewLine(countdownBreakdownLine, previewState.countdownPreview.breakdownLine);
      syncOptionalPreviewLine(
        countdownIgnoredLine,
        previewState.countdownPreview.ignoredExclusionsLine,
      );

      if (countdownAlertStatus) {
        countdownAlertStatus.className = `status-pill status-pill-${previewState.countdownAlertPreview.state}`;
        countdownAlertStatus.textContent = getAlertStatusLabel(previewState.countdownAlertPreview.state);
      }
      if (countdownAlertPreviewNode) {
        countdownAlertPreviewNode.innerHTML = escapeHtml(previewState.countdownAlertPreview.preview)
          .replaceAll("\n", "<br />");
      }
      if (countdownAlertChannelLabel) {
        countdownAlertChannelLabel.textContent = previewState.countdownAlertPreview.channelLabel;
      }
      if (countdownAlertTimeLabel) {
        countdownAlertTimeLabel.textContent = previewState.countdownAlertPreview.timeLabel;
      }
      if (countdownAlertNote) {
        countdownAlertNote.textContent = previewState.countdownAlertPreview.note;
      }
      if (countdownAlertTimeCopy) {
        countdownAlertTimeCopy.textContent = previewState.countdownAlertPreview.timeHelpText;
      }
    }

    function syncSaveBar() {
      const snapshot = serializeForm(form);
      const dashboardState = getDashboardState();
      isDirty = snapshot !== initialSnapshot;

      if (saveBar) {
        saveBar.classList.toggle("is-dirty", isDirty);
      }

      if (saveButton) {
        saveButton.disabled = !isDirty;
      }

      if (discardButton) {
        discardButton.disabled = !isDirty;
      }

      if (saveTitle) {
        saveTitle.textContent = isDirty ? "Unsaved changes" : "All changes saved";
      }

      if (saveStatus) {
        if (isDirty && dashboardState.attentionModules > 0) {
          saveStatus.textContent = `${dashboardState.attentionModules} enabled module${dashboardState.attentionModules === 1 ? "" : "s"} still need setup before save.`;
        } else if (isDirty) {
          saveStatus.textContent = "Review and save when you are ready. These changes only affect this server.";
        } else {
          saveStatus.textContent = "Changes only apply to this server after you save them.";
        }
      }

      syncModuleDiagnostics(dashboardState);
      syncCountdownPreview(dashboardState);
    }

    renderExcludedDates();

    if (excludedDateAddButton) {
      excludedDateAddButton.addEventListener("click", addExcludedDate);
    }
    if (excludedDateInput) {
      excludedDateInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }

        event.preventDefault();
        addExcludedDate();
      });
    }
    if (excludedDateList) {
      excludedDateList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-excluded-date-chip]");
        if (!button) {
          return;
        }

        const isoDate = safeText(button.getAttribute("data-iso-date"));
        if (!isoDate) {
          return;
        }

        setExcludedDates(getExcludedDates().filter((date) => date !== isoDate));
      });
    }

    form.addEventListener("input", syncSaveBar);
    form.addEventListener("change", syncSaveBar);
    form.addEventListener("reset", () => {
      window.requestAnimationFrame(() => {
        const modeField = getField("countdownMode");
        const alertToggle = getField("countdownAlertEnabled");
        if (modeField) {
          modeField.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (alertToggle) {
          alertToggle.dispatchEvent(new Event("change", { bubbles: true }));
        }
        renderExcludedDates();
        syncSaveBar();
      });
    });
    form.addEventListener("submit", () => {
      isDirty = false;
      if (saveTitle) {
        saveTitle.textContent = "Saving changes";
      }
      if (saveStatus) {
        saveStatus.textContent = "Blueprint is saving this server configuration now.";
      }
      if (saveButton) {
        saveButton.disabled = true;
      }
      if (discardButton) {
        discardButton.disabled = true;
      }
    });

    window.addEventListener("beforeunload", (event) => {
      if (!isDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    });

    syncSaveBar();
  }

  function serializeForm(form) {
    const entries = Array.from(new FormData(form).entries())
      .map(([key, value]) => [key, String(value)])
      .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
        if (leftKey === rightKey) {
          return leftValue.localeCompare(rightValue);
        }

        return leftKey.localeCompare(rightKey);
      });

    return JSON.stringify(entries);
  }

  function normalizeCountdownMode(value) {
    return value === "active-days" ? "active-days" : "calendar";
  }

  function normalizeIsoDateInput(value) {
    const raw = safeText(value);
    if (!raw) {
      return "";
    }

    return parseIsoDate(raw) ? raw : "";
  }

  function normalizeWeekdaySelection(values) {
    const weekdays = Array.from(
      new Set(
        (Array.isArray(values) ? values : [values])
          .map((value) => Number.parseInt(String(value), 10))
          .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6),
      ),
    ).sort((left, right) => left - right);

    return weekdays.length ? weekdays : [...DEFAULT_WEEKDAYS];
  }

  function normalizeCountdownAlertTime(value) {
    const raw = safeText(value);
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(raw) ? raw : "09:00";
  }

  function normalizeCountdownAlertTimeZone(value) {
    const raw = safeText(value);
    if (!raw) {
      return "UTC";
    }

    try {
      new Intl.DateTimeFormat("en-US", { timeZone: raw }).format(new Date());
      return raw;
    } catch {
      return "UTC";
    }
  }

  function normalizeExcludedDatesValue(value) {
    const tokens = String(value || "")
      .split(/[\s,]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    return Array.from(new Set(tokens.map(normalizeIsoDateInput).filter(Boolean))).sort();
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
    return parsed ? dateLabelFormatter.format(parsed) : "";
  }

  function formatExcludedDateChipLabel(value) {
    return formatDateLabel(value) || value;
  }

  function renderExcludedDateChips(dates) {
    return dates
      .map((isoDate) => `
        <button
          class="date-chip"
          type="button"
          data-excluded-date-chip
          data-iso-date="${escapeHtml(isoDate)}"
        >
          <span>${escapeHtml(formatExcludedDateChipLabel(isoDate))}</span>
          <span aria-hidden="true">Remove</span>
        </button>
      `)
      .join("");
  }

  function calculateCountdownPreview(data) {
    const enabled = Boolean(data.enabled);
    const title = safeText(data.title);
    const targetDate = normalizeIsoDateInput(data.targetDate);
    const mode = normalizeCountdownMode(data.mode);
    const weekdays = normalizeWeekdaySelection(data.weekdays);
    const excludedDates = normalizeExcludedDatesValue(data.excludedDates);

    if (!enabled) {
      return {
        breakdownLine: "",
        commandPreview: "The countdown feature is disabled in this server.",
        excludedDates,
        ignoredExclusionsLine: "",
        metaLine: "Turn the feature on to make /countdown available.",
        modeLabel: mode === "calendar" ? "Calendar days" : "Selected weekdays",
        scheduleLine: "",
        state: "disabled",
        targetDateLabel: "",
        title,
      };
    }

    if (!title || !targetDate) {
      return {
        breakdownLine: "",
        commandPreview: "This server's countdown is not fully configured yet.",
        excludedDates,
        ignoredExclusionsLine: "",
        metaLine: "Add an event name and a target date to finish setup.",
        modeLabel: mode === "calendar" ? "Calendar days" : "Selected weekdays",
        scheduleLine: buildScheduleLine(mode, weekdays, null, excludedDates.length),
        state: "incomplete",
        targetDateLabel: targetDate ? formatDateLabel(targetDate) : "",
        title,
      };
    }

    const today = getStartOfCurrentDate(new Date(), normalizeCountdownAlertTimeZone(data.alertTimeZone));
    const target = parseIsoDate(targetDate);
    const targetDateLabel = formatDateLabel(targetDate);
    const differenceInDays = getDayDifference(today, target);
    const activeDayBreakdown = mode === "active-days"
      ? analyzeActiveDayCountdown(today, target, weekdays, excludedDates)
      : null;

    if (differenceInDays < 0) {
      return {
        breakdownLine: "",
        commandPreview: `${title} was on ${targetDateLabel}.`,
        excludedDates,
        ignoredExclusionsLine: "",
        metaLine: "This countdown has already ended.",
        modeLabel: mode === "calendar" ? "Calendar days" : "Selected weekdays",
        scheduleLine: buildScheduleLine(mode, weekdays, activeDayBreakdown),
        state: "past",
        targetDateLabel,
        title,
      };
    }

    if (differenceInDays === 0) {
      return {
        breakdownLine: "",
        commandPreview: `${title} is happening today.`,
        excludedDates,
        ignoredExclusionsLine: "",
        metaLine: `Target date: ${targetDateLabel}`,
        modeLabel: mode === "calendar" ? "Calendar days" : "Selected weekdays",
        scheduleLine: buildScheduleLine(mode, weekdays, activeDayBreakdown),
        state: "today",
        targetDateLabel,
        title,
      };
    }

    const remaining = mode === "calendar" ? differenceInDays : activeDayBreakdown.remaining;
    const unitLabel = mode === "calendar"
      ? `calendar ${remaining === 1 ? "day" : "days"}`
      : `${remaining === 1 ? "selected day" : "selected days"}`;
    const scheduleLine = buildScheduleLine(mode, weekdays, activeDayBreakdown, excludedDates.length);
    const breakdownLine = buildBreakdownLine(mode, activeDayBreakdown);
    const ignoredExclusionsLine = buildIgnoredExclusionsLine(mode, activeDayBreakdown);

    return {
      breakdownLine,
      commandPreview: [
        `${remaining} ${unitLabel} until ${title}`,
        `Target date: ${targetDateLabel}`,
        scheduleLine,
        breakdownLine,
        ignoredExclusionsLine,
      ].filter(Boolean).join("\n"),
      excludedDates,
      ignoredExclusionsLine,
      metaLine:
        mode === "calendar"
          ? "Every calendar day is included."
          : "Only selected weekdays after today and before the target date are counted. Excluded dates only reduce the total when they land on one of those counted days.",
      modeLabel: mode === "calendar" ? "Calendar days" : "Selected weekdays",
      scheduleLine,
      state: "upcoming",
      targetDateLabel,
      title,
    };
  }

  function calculateCountdownAlertPreview(data, countdownPreview) {
    const state = !data.alertEnabled
      ? "disabled"
      : !data.enabled || !data.title || !data.targetDate || !data.alertChannelId
        ? "incomplete"
        : "live";
    const timing = getAlertTiming(data.alertTime, data.alertTimeZone);

    return {
      channelLabel: data.alertChannelLabel,
      note:
        state !== "live"
          ? "Pick a channel and time after the countdown itself is configured."
          : countdownPreview.state === "past"
            ? "The event date has passed, so no further daily alerts will be sent."
            : "Blueprint posts this once per day after the selected local time until the event day arrives.",
      preview:
        state === "live"
          ? buildCountdownAlertPreviewMessage(countdownPreview, timing.timeZone)
          : "Daily alerts stay off until the countdown module is enabled and fully configured.",
      state,
      timeHelpText: timing.timeHelpText,
      timeLabel: timing.timeLabel,
    };
  }

  function buildCountdownAlertPreviewMessage(countdownPreview, timeZone) {
    if (countdownPreview.state === "today") {
      return `${countdownPreview.title} is happening today.\nTarget date: ${countdownPreview.targetDateLabel}`;
    }

    if (countdownPreview.state !== "upcoming") {
      return countdownPreview.commandPreview;
    }

    const isoDate = getCurrentIsoDateInTimeZone(new Date(), timeZone);
    return [
      `Daily countdown alert for ${formatDateLabel(isoDate)}`,
      countdownPreview.commandPreview,
    ].join("\n");
  }

  function getAlertTiming(alertTime, timeZone) {
    const localTimeLabel = normalizeCountdownAlertTime(alertTime);
    const normalizedTimeZone = normalizeCountdownAlertTimeZone(timeZone);
    const dueAtUtc = getUtcDateForTimeZoneLocalTime(
      new Date(),
      normalizedTimeZone,
      localTimeLabel,
    );
    const utcTimeLabel = dueAtUtc
      ? formatTimeLabel(dueAtUtc.getUTCHours(), dueAtUtc.getUTCMinutes())
      : localTimeLabel;
    const timeLabel = normalizedTimeZone === "UTC"
      ? `${utcTimeLabel} UTC`
      : `${localTimeLabel} ${normalizedTimeZone} / ${utcTimeLabel} UTC`;
    const timeHelpText = normalizedTimeZone === "UTC"
      ? `Posts daily at ${utcTimeLabel} UTC.`
      : `Posts daily at ${localTimeLabel} ${normalizedTimeZone}, which is ${utcTimeLabel} UTC right now.`;

    return {
      timeHelpText,
      timeLabel,
      timeZone: normalizedTimeZone,
    };
  }

  function mapCountdownStateToStatus(state) {
    if (state === "upcoming") {
      return "live";
    }

    if (state === "today") {
      return "today";
    }

    if (state === "past") {
      return "ended";
    }

    if (state === "incomplete") {
      return "incomplete";
    }

    return "disabled";
  }

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

  function getAlertStatusLabel(state) {
    return state === "live" ? "Live" : state === "incomplete" ? "Needs setup" : "Disabled";
  }

  function syncOptionalPreviewLine(node, text) {
    if (!node) {
      return;
    }

    node.textContent = text || "";
    node.classList.toggle("is-hidden", !text);
  }

  function formatWeekdayList(weekdays) {
    return normalizeWeekdaySelection(weekdays)
      .map((weekday) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][weekday])
      .join(", ");
  }

  function analyzeActiveDayCountdown(today, target, weekdays, excludedDates) {
    const allowedWeekdays = new Set(normalizeWeekdaySelection(weekdays));
    const normalizedExcludedDates = normalizeExcludedDatesValue(excludedDates.join(","));
    const excluded = new Set(normalizedExcludedDates);
    const effectiveExcludedDates = [];
    const ignoredExcludedDates = [];
    let eligibleDayCount = 0;
    let remaining = 0;

    normalizedExcludedDates.forEach((isoDate) => {
      const reason = getIgnoredExclusionReason(isoDate, today, target, allowedWeekdays);
      if (reason) {
        ignoredExcludedDates.push({ isoDate, reason });
        return;
      }

      effectiveExcludedDates.push(isoDate);
    });

    for (let cursor = addDays(today, 1); cursor < target; cursor = addDays(cursor, 1)) {
      const isoDate = cursor.toISOString().slice(0, 10);
      if (!allowedWeekdays.has(cursor.getUTCDay())) {
        continue;
      }

      eligibleDayCount += 1;
      if (!excluded.has(isoDate)) {
        remaining += 1;
      }
    }

    return {
      effectiveExcludedCount: effectiveExcludedDates.length,
      eligibleDayCount,
      ignoredExcludedCount: ignoredExcludedDates.length,
      ignoredExcludedDates,
      remaining,
    };
  }

  function buildScheduleLine(mode, weekdays, activeDayBreakdown, enteredExcludedCount) {
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

    if (activeDayBreakdown.effectiveExcludedCount > 0) {
      parts.push(
        `Effective exclusions: ${activeDayBreakdown.effectiveExcludedCount} ${activeDayBreakdown.effectiveExcludedCount === 1 ? "date" : "dates"}`,
      );
    }

    if (activeDayBreakdown.ignoredExcludedCount > 0) {
      parts.push(
        `Ignored exclusions: ${activeDayBreakdown.ignoredExcludedCount} ${activeDayBreakdown.ignoredExcludedCount === 1 ? "date" : "dates"}`,
      );
    }

    return parts.join(" | ");
  }

  function buildBreakdownLine(mode, activeDayBreakdown) {
    if (mode !== "active-days" || !activeDayBreakdown) {
      return "";
    }

    return `Weekdays in range: ${activeDayBreakdown.eligibleDayCount} | Removed by exclusions: ${activeDayBreakdown.effectiveExcludedCount} | Final countdown: ${activeDayBreakdown.remaining}`;
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

  function getCurrentIsoDateInTimeZone(value, timeZone) {
    const parts = getZonedDateParts(value, normalizeCountdownAlertTimeZone(timeZone));
    return `${parts.year}-${padNumber(parts.month)}-${padNumber(parts.day)}`;
  }

  function getStartOfCurrentDate(value, timeZone) {
    const isoDate = getCurrentIsoDateInTimeZone(value, timeZone);
    return parseIsoDate(isoDate) || new Date(Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
    ));
  }

  function getUtcDateForTimeZoneLocalTime(referenceDate, timeZone, timeLabel) {
    const [hours, minutes] = normalizeCountdownAlertTime(timeLabel).split(":");
    const parts = getZonedDateParts(referenceDate, normalizeCountdownAlertTimeZone(timeZone));
    const desiredAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      Number.parseInt(hours, 10),
      Number.parseInt(minutes, 10),
    );
    let guess = new Date(desiredAsUtc);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const guessParts = getZonedDateParts(guess, normalizeCountdownAlertTimeZone(timeZone));
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

  function getZonedDateParts(value, timeZone) {
    const normalizedTimeZone = normalizeCountdownAlertTimeZone(timeZone);
    if (!zonedFormatterCache.has(normalizedTimeZone)) {
      zonedFormatterCache.set(
        normalizedTimeZone,
        new Intl.DateTimeFormat("en-CA", {
          day: "2-digit",
          hour: "2-digit",
          hourCycle: "h23",
          minute: "2-digit",
          month: "2-digit",
          timeZone: normalizedTimeZone,
          year: "numeric",
        }),
      );
    }

    const parts = zonedFormatterCache.get(normalizedTimeZone).formatToParts(value);
    const mapped = Object.fromEntries(
      parts
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

  function getDayDifference(start, end) {
    return Math.round((end.getTime() - start.getTime()) / 86400000);
  }

  function addDays(date, amount) {
    return new Date(date.getTime() + amount * 86400000);
  }

  function formatTimeLabel(hours, minutes) {
    return `${padNumber(hours)}:${padNumber(minutes)}`;
  }

  function padNumber(value) {
    return String(value).padStart(2, "0");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  async function handleAuthComplete() {
    const marker = document.querySelector("[data-auth-complete='true']");
    if (!marker) {
      return;
    }

    const returnTo = safeText(marker.getAttribute("data-return-to")) || "/dashboard";

    try {
      await syncFromDashboard(returnTo);
    } catch (error) {
      marker.textContent =
        error.message || "No active Continental ID session was found. Use sign-in to continue.";
    }
  }

  window.addEventListener("message", async (event) => {
    if (!isTrustedLoginOrigin(event.origin)) {
      return;
    }

    const messageType = safeText(event.data && event.data.type);
    if (!messageType) {
      return;
    }

    try {
      if (messageType === "LOGIN_SUCCESS") {
        const accessToken = safeText(
          (event.data && (event.data.accessToken || event.data.token)) || "",
        );
        if (!accessToken) {
          throw new Error("The login popup did not provide an access token.");
        }

        await syncLocalSession(accessToken);
        window.location.href = currentPath === "/" ? "/dashboard" : currentPath;
        return;
      }

      if (messageType === "OAUTH_LINKED") {
        await syncFromDashboard(currentPath);
      }
    } catch (error) {
      window.alert(error.message || "Authentication could not be completed.");
    }
  });

  bindLoginButtons();
  bindLinkDiscordButton();
  bindModuleCards();
  bindCountdownControls();
  bindGuildSearchControls();
  bindSettingsFormUX();
  handleAuthComplete();
})();
