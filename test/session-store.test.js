const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const { createSessionStore } = require("../src/session-store");

test("sqlite session store persists and destroys sessions", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "blueprint-sessions-"));
  const store = createSessionStore({ dataDir, ttlMs: 60_000 });

  try {
    await setSession(store, "sid-1", {
      cookie: { maxAge: 60_000 },
      user: { id: "user-1" },
    });

    const storedSession = await getSession(store, "sid-1");
    assert.equal(storedSession.user.id, "user-1");

    await destroySession(store, "sid-1");
    assert.equal(await getSession(store, "sid-1"), null);
  } finally {
    store.close();
    fs.rmSync(dataDir, { force: true, recursive: true });
  }
});

function getSession(store, sid) {
  return new Promise((resolve, reject) => {
    store.get(sid, (error, session) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(session);
    });
  });
}

function setSession(store, sid, session) {
  return new Promise((resolve, reject) => {
    store.set(sid, session, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function destroySession(store, sid) {
  return new Promise((resolve, reject) => {
    store.destroy(sid, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
