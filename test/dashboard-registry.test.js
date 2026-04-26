const test = require("node:test");
const assert = require("node:assert/strict");

const {
  evaluateDashboardModules,
  getRuntimeModuleValidationErrors,
} = require("../src/modules/dashboard-registry");
const { getReactionRoleState } = require("../src/modules/reaction-roles");

test("reaction roles stay incomplete without a setup message id", () => {
  assert.equal(
    getReactionRoleState({
      reactionRolesChannelId: "123456789012345678",
      reactionRolesEnabled: true,
      reactionRolesMessageId: "",
    }),
    "incomplete",
  );

  assert.equal(
    getReactionRoleState({
      reactionRolesChannelId: "123456789012345678",
      reactionRolesEnabled: true,
      reactionRolesMessageId: "223456789012345678",
    }),
    "live",
  );
});

test("dashboard blocks modules that do not have runtime support yet", () => {
  const modules = evaluateDashboardModules({
    settings: {
      aiToolsEnabled: true,
      antiRaidEnabled: true,
      applicationsEnabled: true,
      automationsEnabled: true,
      levelingEnabled: true,
      modmailEnabled: true,
      reactionRolesEnabled: true,
      ticketsEnabled: true,
    },
  });
  const byKey = Object.fromEntries(modules.map((module) => [module.key, module]));

  assert.equal(byKey.aiTools.state, "incomplete");
  assert.match(byKey.aiTools.blocker, /bot runtime does not reply in-channel yet/i);
  assert.equal(byKey.reactionRoles.state, "incomplete");
  assert.match(byKey.reactionRoles.blocker, /not wired into the bot runtime yet/i);
  assert.equal(byKey.tickets.state, "incomplete");
  assert.match(byKey.tickets.blocker, /does not open ticket channels yet/i);
});

test("unsupported enabled modules fail validation before save", () => {
  const errors = getRuntimeModuleValidationErrors({
    aiToolsEnabled: true,
    reactionRolesEnabled: true,
    ticketsEnabled: false,
  });

  assert.equal(errors.length, 2);
  assert.match(errors[0], /runtime/i);
  assert.match(errors[1], /runtime/i);
});
