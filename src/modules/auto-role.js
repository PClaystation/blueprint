const { PermissionFlagsBits } = require("discord.js");

const { escapeHtml, renderModuleCard, renderModuleFacts } = require("../html");

const defaults = {
  autoRoleEnabled: false,
  autoRoleRoleId: "",
};

function normalizeAutoRoleSettings(input = {}) {
  return {
    autoRoleEnabled: input.autoRoleEnabled === true || input.autoRoleEnabled === "on",
    autoRoleRoleId: normalizeId(input.autoRoleRoleId),
  };
}

function getAutoRoleOptions(guild, botMember) {
  return guild.roles.cache
    .filter((role) => isAssignableRole(role, botMember))
    .sort((left, right) => right.position - left.position || left.name.localeCompare(right.name))
    .map((role) => ({
      id: role.id,
      label: role.name,
    }));
}

function validateAutoRoleSettings(settings, guild, botMember) {
  if (!settings.autoRoleEnabled) {
    return [];
  }

  if (!settings.autoRoleRoleId) {
    return ["Select a role before enabling auto role assignment."];
  }

  if (!botMember) {
    return ["Blueprint could not verify its role permissions in this server."];
  }

  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return ["Blueprint needs Manage Roles before it can assign a default join role."];
  }

  const role = guild.roles.cache.get(settings.autoRoleRoleId);
  if (!role || role.id === guild.id || role.managed) {
    return ["The selected auto role is no longer available for assignment."];
  }

  if (botMember.roles.highest.comparePositionTo(role) <= 0) {
    return ["Move Blueprint above the selected role in the server role list before enabling auto role."];
  }

  return [];
}

function renderAutoRoleModuleCard({ blockerText = "", roleOptions, settings }) {
  const state = getAutoRoleState(settings, roleOptions);
  const roleSelectOptions = [
    `<option value="">Select a role</option>`,
    ...roleOptions.map((role) => `
      <option value="${escapeHtml(role.id)}" ${
        settings.autoRoleRoleId === role.id ? "selected" : ""
      }>
        ${escapeHtml(role.label)}
      </option>
    `),
  ].join("");
  const statusHtml = `
    <div class="status-pill status-pill-${state}" data-status-target="autoRole">${escapeHtml(getAutoRoleStatusLabel(state))}</div>
  `;
  const summaryHtml = renderModuleFacts([
    {
      label: "Default role",
      valueHtml: escapeHtml(getRoleLabel(settings.autoRoleRoleId, roleOptions)),
    },
    {
      label: "Applies to",
      valueHtml: "New human members",
    },
  ]);

  return renderModuleCard({
    bodyHtml: `
      <div class="module-layout">
        <div class="module-fields">
          <div class="field-grid">
            <label>
              <span>Default role</span>
              <select name="autoRoleRoleId">
                ${roleSelectOptions}
              </select>
              <small>Only roles Blueprint can safely assign are shown here.</small>
            </label>
          </div>
        </div>

        <aside class="preview-card">
          <span class="preview-label">Module summary</span>
          <div class="countdown-preview">${escapeHtml(getAutoRolePreview(roleOptions, settings, state))}</div>
          <div class="preview-meta preview-meta-dual">
            <div>
              <span>Role</span>
              <strong>${escapeHtml(getRoleLabel(settings.autoRoleRoleId, roleOptions))}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>${escapeHtml(getAutoRoleStatusLabel(state))}</strong>
            </div>
          </div>
          <p class="preview-note">Bot accounts are skipped automatically.</p>
        </aside>
      </div>
    `,
    checked: settings.autoRoleEnabled,
    blockerHtml: escapeHtml(blockerText),
    descriptionHtml:
      "Assign one default role to new human members as soon as they join the server.",
    eyebrow: "Auto role",
    inputName: "autoRoleEnabled",
    moduleKey: "autoRole",
    moduleId: "auto-role",
    statusHtml,
    summaryHtml,
    theme: "auto-role",
    titleHtml: "Join role assignment",
  });
}

async function assignAutoRole(member, settings) {
  if (!settings.autoRoleEnabled || member.user.bot) {
    return;
  }

  const role = member.guild.roles.cache.get(settings.autoRoleRoleId);
  if (!role) {
    return;
  }

  const botMember = await getBotMember(member.guild, member.client.user.id);
  const errors = validateAutoRoleSettings(settings, member.guild, botMember);
  if (errors.length > 0) {
    return;
  }

  await member.roles.add(role, "Blueprint auto role");
}

module.exports = {
  assignAutoRole,
  defaults,
  getAutoRoleOptions,
  getAutoRoleState,
  getAutoRoleStatusLabel,
  normalizeAutoRoleSettings,
  renderAutoRoleModuleCard,
  validateAutoRoleSettings,
};

function getAutoRoleState(settings, roleOptions = []) {
  if (!settings.autoRoleEnabled) {
    return "disabled";
  }

  if (!settings.autoRoleRoleId) {
    return "incomplete";
  }

  if (roleOptions.length > 0 && !roleOptions.some((role) => role.id === settings.autoRoleRoleId)) {
    return "incomplete";
  }

  return "live";
}

function getAutoRoleStatusLabel(state) {
  if (state === "live") {
    return "Live";
  }

  if (state === "incomplete") {
    return "Needs setup";
  }

  return "Disabled";
}

function getAutoRolePreview(roleOptions, settings, state) {
  if (state !== "live") {
    return "Auto role assignment is disabled until a default role is selected.";
  }

  return `New members receive ${getRoleLabel(settings.autoRoleRoleId, roleOptions)} as soon as they join.`;
}

function getRoleLabel(roleId, roleOptions) {
  if (!roleId) {
    return "Not selected";
  }

  return roleOptions.find((role) => role.id === roleId)?.label || "Unavailable";
}

function normalizeId(value) {
  return /^\d{16,20}$/.test(String(value || "").trim()) ? String(value).trim() : "";
}

function isAssignableRole(role, botMember) {
  if (!role || role.managed || role.id === role.guild.id) {
    return false;
  }

  if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return false;
  }

  return botMember.roles.highest.comparePositionTo(role) > 0;
}

async function getBotMember(guild, clientUserId) {
  if (guild.members.me) {
    return guild.members.me;
  }

  try {
    return await guild.members.fetch(clientUserId);
  } catch {
    return null;
  }
}
