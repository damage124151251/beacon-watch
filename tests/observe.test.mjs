import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSnapshot,
  createObserver,
  compare,
} from "../server/observe.mjs";
import { tick } from "../server/worker.mjs";
import { initialState } from "../server/config.mjs";
import { visibleStatus, endpoint } from "../src/catalog.mjs";
import { authorized } from "../server/http.mjs";
const at = "2026-10-01T08:00:00.000Z";
const feed = () => ({
  page: { id: "kctbh9vrtdwd", updated_at: at },
  status: { indicator: "none", description: "All Systems Operational" },
  components: [{ id: "api", name: "API", status: "operational" }],
  incidents: [],
  scheduled_maintenances: [],
});
const snapshot = (input = feed()) =>
  normalizeSnapshot("github", input, {
    observedAt: at,
    inputHash: "a".repeat(64),
  });
function memory() {
  let state = initialState();
  state.stations = state.stations.slice(0, 1);
  return {
    get: () => state,
    store: async (fn) => {
      const n = await fn(structuredClone(state));
      if (n) state = n;
      return structuredClone(state);
    },
  };
}
test("observer only allows the fixed provider catalog", async () => {
  for (const id of [
    "http://127.0.0.1",
    "file:///secret",
    "https://status.solana.com",
    "../github",
    "unknown",
  ])
    assert.throws(() => endpoint(id));
});
test("provider identity and known status enums are required", () => {
  const d = feed();
  d.page.id = "another-provider";
  assert.throws(() => snapshot(d));
  d.page.id = "kctbh9vrtdwd";
  d.status.indicator = "healthy";
  assert.throws(() => snapshot(d));
});
test("invalid components, duplicate IDs and missing arrays fail closed", () => {
  const d = feed();
  d.components[0].status = "not-valid";
  assert.throws(() => snapshot(d));
  d.components[0].status = "operational";
  d.components.push(d.components[0]);
  assert.throws(() => snapshot(d));
  delete d.components;
  assert.throws(() => snapshot(d));
});
test("first observation is a baseline, not a recovered service", () => {
  assert.equal(compare(null, snapshot())[0].kind, "baseline");
});
test("unchanged status creates no manufactured incidents", () => {
  assert.deepEqual(compare(snapshot(), snapshot()), []);
});
test("provider degradation and recovery are separate actual transitions", () => {
  const d = feed();
  d.status.indicator = "major";
  d.components[0].status = "major_outage";
  const failed = snapshot(d);
  assert.equal(compare(snapshot(), failed)[0].kind, "status");
  assert.equal(compare(failed, snapshot())[0].kind, "recovery");
});
test("incident removal does not claim an unverified resolution", () => {
  const d = feed();
  d.incidents = [
    { id: "event", name: "Issue", status: "investigating", updated_at: at },
  ];
  const changes = compare(snapshot(d), snapshot());
  assert.match(changes[0].detail, /No longer in/);
  assert.ok(!changes[0].detail.includes("resolved"));
});
test("stale, paused and unavailable feeds are not operational", () => {
  const s = { enabled: true, latest: snapshot(), error: null };
  assert.equal(visibleStatus(s, Date.parse(at) + 13 * 60000), "stale");
  assert.equal(
    visibleStatus({ ...s, error: "timeout" }, Date.parse(at)),
    "unavailable",
  );
  assert.equal(
    visibleStatus({ ...s, enabled: false }, Date.parse(at)),
    "paused",
  );
});
test("fetch uses canonical URL, blocks redirects and stores a body checksum", async () => {
  let called;
  const observe = createObserver({
    fetcher: async (u, o) => {
      called = { u, o };
      return new Response(JSON.stringify(feed()), {
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  const s = await observe("github");
  assert.equal(called.u, endpoint("github"));
  assert.equal(called.o.redirect, "error");
  assert.ok(/^[a-f0-9]{64}$/.test(s.inputHash));
  assert.equal(s.httpStatus, 200);
});
test("HTTP error or malformed JSON cannot become a service outage", async () => {
  await assert.rejects(
    () =>
      createObserver({
        fetcher: async () => new Response("", { status: 503 }),
      })("github"),
    /Service state is unknown/,
  );
  await assert.rejects(
    () =>
      createObserver({ fetcher: async () => new Response("not json") })(
        "github",
      ),
    /not JSON/,
  );
});
test("oversized provider responses are rejected", async () => {
  await assert.rejects(
    () =>
      createObserver({
        fetcher: async () =>
          new Response("{}", { headers: { "content-length": "2000001" } }),
      })("github"),
    /size limit/,
  );
});
test("worker persists all three stages and real observation evidence", async () => {
  const m = memory();
  await tick({
    store: m.store,
    observe: async () => snapshot(),
    now: () => Date.parse(at),
  });
  assert.equal(m.get().runs[0].status, "completed");
  assert.equal(m.get().runs[0].steps.length, 3);
  assert.ok(m.get().runs[0].steps.every((s) => s.status === "done"));
  assert.equal(m.get().stations[0].latest.inputHash, "a".repeat(64));
  assert.equal(m.get().changes[0].kind, "baseline");
});
test("same cycle and active leases prevent duplicate work", async () => {
  const m = memory();
  let calls = 0;
  const opts = {
    store: m.store,
    observe: async () => {
      calls++;
      return snapshot();
    },
    now: () => Date.parse(at),
  };
  await tick(opts);
  await tick(opts);
  assert.equal(calls, 1);
});
test("feed failure preserves prior service state and writes unknown sample", async () => {
  const m = memory();
  m.get().stations[0].latest = snapshot();
  await tick({
    store: m.store,
    observe: async () => {
      throw Error("timeout");
    },
    now: () => Date.parse(at),
  });
  assert.equal(m.get().stations[0].latest.indicator, "none");
  assert.equal(m.get().stations[0].history[0].indicator, "unavailable");
  assert.equal(m.get().runs[0].status, "failed");
  assert.equal(m.get().changes[0].kind, "feed");
});
test("pausing in flight cannot publish a late observation", async () => {
  const m = memory();
  await tick({
    store: m.store,
    observe: async () => {
      await m.store((s) => {
        s.paused = true;
        s.revision++;
        return s;
      });
      return snapshot();
    },
    now: () => Date.parse(at),
  });
  assert.equal(m.get().runs[0].status, "cancelled");
  assert.equal(m.get().stations[0].latest, null);
});
test("removing in-flight station cannot recreate it", async () => {
  const m = memory();
  await tick({
    store: m.store,
    observe: async () => {
      await m.store((s) => {
        s.stations = [];
        s.revision++;
        return s;
      });
      return snapshot();
    },
    now: () => Date.parse(at),
  });
  assert.equal(m.get().stations.length, 0);
  assert.equal(m.get().runs[0].status, "cancelled");
});
test("operator credentials are exact and long enough", () => {
  const secret = "a".repeat(40);
  assert.equal(
    authorized({ headers: { authorization: "Bearer " + secret } }, secret),
    true,
  );
  assert.equal(authorized({ headers: {} }, secret), false);
  assert.equal(
    authorized({ headers: { authorization: "Bearer a" } }, "a"),
    false,
  );
});
