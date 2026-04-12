(function () {
  const config = window.BLUEPRINT_AUTH || {};
  const trustedLoginOrigins = new Set(config.trustedLoginOrigins || []);
  const currentPath = `${window.location.pathname}${window.location.search}`;

  function safeText(value) {
    return String(value || "").trim();
  }

  function isTrustedLoginOrigin(origin) {
    return trustedLoginOrigins.has(origin);
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
  bindCountdownControls();
  handleAuthComplete();
})();
