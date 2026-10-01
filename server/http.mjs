import { timingSafeEqual } from "node:crypto";
import { readState, updateState } from "./store.mjs";
import { station } from "./config.mjs";
import { provider, visibleStatus } from "../src/catalog.mjs";
import { addressValid } from "../src/domain.mjs";
import { GITHUB_URL, TOKEN_CA, X_URL } from "../src/config.mjs";
import { tick } from "./worker.mjs";
import { watchLaunch } from "./launch.mjs";
import { createRpc, MAINNET_GENESIS } from "./rpc.mjs";
export function authorized(req, secret) {
  const value = req.headers.authorization || "",
    expected = `Bearer ${secret}`;
  return (
    typeof secret === "string" &&
    secret.length >= 32 &&
    typeof value === "string" &&
    Buffer.byteLength(value) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(value), Buffer.from(expected))
  );
}
const json = (res, status, data) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
};
async function body(req) {
  if (req.body && typeof req.body === "object") {
    if (Buffer.byteLength(JSON.stringify(req.body)) > 4096)
      throw Error("Invalid request size.");
    return req.body;
  }
  let raw = "";
  for await (const part of req) {
    raw += part;
    if (Buffer.byteLength(raw) > 4096) throw Error("Invalid request size.");
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw Error("Invalid JSON request.");
  }
}
export async function handler(req, res) {
  try {
    const path = new URL(req.url, "http://localhost").pathname;
    if (path === "/api/health" && req.method === "GET")
      return json(res, 200, {
        ok: true,
        service: "BEACON",
        mode: "provider-status-observation",
      });
    if (path === "/api/status" && req.method === "GET") {
      const { data: s } = await readState(),
        now = Date.now(),
        ca = TOKEN_CA || s.launchState?.pinned?.mint || null;
      return json(res, 200, {
        serverTime: new Date(now).toISOString(),
        paused: s.paused,
        running: !!s.lease && s.lease.until > now,
        stations: s.stations.map((x) => ({
          ...x,
          visibleStatus: visibleStatus(x, now),
        })),
        runs: s.runs.map((r) =>
          r.status === "running" && (!s.lease || s.lease.until < now)
            ? {
                ...r,
                status: "interrupted",
                error: "Worker ended before recording a result.",
              }
            : r,
        ),
        events: s.events,
        changes: s.changes,
        cycleCount: s.cycleCount,
        lastCompleted: s.lastCompleted,
        lastScheduledCompletion: s.lastScheduledCompletion,
        scheduler: {
          minutes: 5,
          configured: !!process.env.VERCEL && !!process.env.CRON_SECRET,
        },
        identity: {
          wallet: s.identitySettings?.wallet || null,
          startSlot: s.identitySettings?.startSlot || null,
          tokenCA: ca,
          proof:
            s.launchState?.pinned?.mint === ca ? s.launchState.pinned : null,
          github: GITHUB_URL,
          x: X_URL,
          watchStatus: s.watchStatus,
          checkedAt: s.watchAt || null,
        },
      });
    }
    if (["/api/tick", "/api/watch"].includes(path) && req.method === "GET") {
      if (!authorized(req, process.env.CRON_SECRET))
        return json(res, 401, { error: "Scheduler authorization required." });
      return json(
        res,
        200,
        path === "/api/tick" ? await tick() : await watchLaunch(),
      );
    }
    if (path !== "/api/operator")
      return json(res, 404, { error: "Not found." });
    if (!authorized(req, process.env.BEACON_OPERATOR_KEY))
      return json(res, 401, { error: "Operator access required." });
    if (req.method === "GET") return json(res, 200, { authorized: true });
    if (req.method !== "POST")
      return json(res, 405, { error: "Method not allowed." });
    const origins = (
      process.env.PUBLIC_ORIGINS ||
      process.env.PUBLIC_ORIGIN ||
      "http://127.0.0.1:5250"
    )
      .split(",")
      .map((x) => x.trim());
    if (req.headers.origin && !origins.includes(req.headers.origin))
      return json(res, 403, { error: "Origin rejected." });
    const input = await body(req);
    if (input.action === "run")
      return json(res, 200, await tick({ manual: true }));
    if (input.action === "watch") return json(res, 200, await watchLaunch());
    if (input.action === "add-station") {
      if (!provider(input.id)) throw Error("Invalid station.");
      await updateState((s) => {
        if (s.stations.some((x) => x.id === input.id))
          throw Error("Station already connected.");
        s.stations.push(station(input.id));
        return s;
      });
      return json(res, 201, { ok: true });
    }
    if (input.action === "toggle-station") {
      if (typeof input.enabled !== "boolean")
        throw Error("Invalid enabled state.");
      await updateState((s) => {
        const x = s.stations.find((x) => x.id === input.id);
        if (!x) throw Error("Station not found.");
        x.enabled = input.enabled;
        x.revision++;
        return s;
      });
      return json(res, 200, { ok: true });
    }
    if (input.action === "remove-station") {
      await updateState((s) => {
        if (!s.stations.some((x) => x.id === input.id))
          throw Error("Station not found.");
        s.stations = s.stations.filter((x) => x.id !== input.id);
        s.revision++;
        return s;
      });
      return json(res, 200, { ok: true });
    }
    if (input.action === "pause") {
      if (typeof input.paused !== "boolean")
        throw Error("Invalid pause state.");
      await updateState((s) => {
        s.paused = input.paused;
        s.revision++;
        return s;
      });
      return json(res, 200, { ok: true });
    }
    if (input.action === "set-wallet") {
      if (!addressValid(input.wallet))
        throw Error("Use a public Solana wallet address.");
      const rpc = createRpc();
      if ((await rpc("getGenesisHash")) !== MAINNET_GENESIS)
        throw Error("Mainnet identity mismatch.");
      const startSlot = await rpc("getSlot", [{ commitment: "finalized" }]);
      if (!Number.isSafeInteger(startSlot) || startSlot <= 0)
        throw Error("Finalized slot unavailable.");
      await updateState((s) => {
        if (s.identitySettings?.wallet === input.wallet) return null;
        s.identitySettings = { wallet: input.wallet, startSlot };
        s.launchState = null;
        s.watchLease = null;
        s.watchBucket = null;
        s.watchAt = null;
        s.watchStatus = "watching";
        return s;
      });
      return json(res, 200, { ok: true });
    }
    throw Error("Invalid operation.");
  } catch (e) {
    const known = /^(Invalid |Use |Station )/.test(e.message);
    return json(res, known ? 400 : 503, {
      error: known
        ? e.message
        : "Operation unavailable. Previously recorded observations remain stored.",
    });
  }
}
