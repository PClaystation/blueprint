const test = require("node:test");
const assert = require("node:assert/strict");

const { Collection } = require("discord.js");

const {
  STARBOARD_EMOJI,
  buildStarboardPostContent,
  getStarboardReactionCount,
  getStarboardState,
  normalizeStarboardSettings,
} = require("../src/modules/starboard");

test("starboard settings normalize ids and clamp thresholds", () => {
  const settings = normalizeStarboardSettings({
    starboardAllowSelfStar: "on",
    starboardChannelId: "123456789012345678",
    starboardEnabled: "on",
    starboardThreshold: "99",
  });

  assert.deepEqual(settings, {
    starboardAllowSelfStar: true,
    starboardChannelId: "123456789012345678",
    starboardEnabled: true,
    starboardThreshold: 25,
  });
});

test("starboard state stays incomplete until a destination channel is selected", () => {
  assert.equal(
    getStarboardState({
      starboardChannelId: "",
      starboardEnabled: true,
    }),
    "incomplete",
  );

  assert.equal(
    getStarboardState({
      starboardChannelId: "123456789012345678",
      starboardEnabled: true,
    }),
    "live",
  );
});

test("starboard posts include a compact quote and attachment preview", () => {
  const content = buildStarboardPostContent({
    message: {
      attachments: new Map([
        [
          "file",
          {
            contentType: "image/png",
            url: "https://cdn.example.com/post.png",
          },
        ],
      ]),
      author: { id: "42" },
      channelId: "99",
      content: "This is a standout message that deserves to be featured.",
      url: "https://discord.com/channels/1/99/100",
    },
    starCount: 4,
  });

  assert.match(content, new RegExp(`^${STARBOARD_EMOJI} \\*\\*4\\*\\* in <#99> by <@42>`));
  assert.match(content, /> This is a standout message that deserves to be featured\./);
  assert.match(content, /https:\/\/discord\.com\/channels\/1\/99\/100/);
  assert.match(content, /https:\/\/cdn\.example\.com\/post\.png/);
});

test("starboard counts ignore bots and optional self-stars", async () => {
  const reaction = {
    users: {
      fetch: async () =>
        new Collection([
          ["1", { bot: false, id: "1" }],
          ["2", { bot: false, id: "2" }],
          ["3", { bot: true, id: "3" }],
        ]),
    },
  };

  assert.equal(
    await getStarboardReactionCount(reaction, {
      allowSelfStar: false,
      authorId: "1",
    }),
    1,
  );

  assert.equal(
    await getStarboardReactionCount(reaction, {
      allowSelfStar: true,
      authorId: "1",
    }),
    2,
  );
});
