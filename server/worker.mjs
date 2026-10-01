import { randomUUID } from "node:crypto";
import { updateState } from "./store.mjs";
import { createObserver, compare } from "./observe.mjs";
export async function tick({
  store = updateState,
  observe = createObserver(),
  now = Date.now,
  manual = false,
} = {}) {
  const start = now(),
    id = randomUUID(),
    bucket = Math.floor(start / 300000),
    stamp = () => new Date(now()).toISOString();
  const acquired = await store((s) => {
    if (s.lease?.until > start || s.lastBucket === bucket) return null;
    s.lease = { id, until: start + 90000 };
    s.runs = s.runs.map((r) =>
      r.status === "running"
        ? {
            ...r,
            status: "interrupted",
            finishedAt: stamp(),
            error: "Previous worker ended before recording a result.",
          }
        : r,
    );
    return s;
  });
  if (acquired.lease?.id !== id)
    return {
      skipped: true,
      reason: "This five-minute cycle is already running or completed.",
    };
  const save = (fn) =>
    store((s) => {
      if (s.lease?.id !== id || s.lease.until < now())
        throw Error("Worker lease expired.");
      return fn(s);
    });
  const event = (s, run, stage, detail) => {
    s.events = [
      {
        id: randomUUID(),
        runId: run.id,
        stationId: run.stationId,
        stage,
        at: stamp(),
        detail,
      },
      ...s.events,
    ].slice(0, 200);
  };
  for (const station of acquired.paused
    ? []
    : acquired.stations.filter((x) => x.enabled)) {
    const run = {
      id: randomUUID(),
      stationId: station.id,
      startedAt: stamp(),
      finishedAt: null,
      status: "running",
      stage: "listen",
      steps: [{ stage: "listen", status: "running", startedAt: stamp() }],
      snapshot: null,
      changes: [],
      error: null,
    };
    const valid = (s) =>
      !s.paused &&
      s.revision === acquired.revision &&
      s.stations.some(
        (x) =>
          x.id === station.id && x.enabled && x.revision === station.revision,
      );
    try {
      await save((s) => {
        if (!valid(s)) throw Error("Station changed.");
        s.runs = [run, ...s.runs].slice(0, 80);
        event(s, run, "listen", "Requesting the official status summary.");
        return s;
      });
      const snapshot = await observe(station.id);
      await save((s) => {
        if (!valid(s)) throw Error("Station changed.");
        const r = s.runs.find((x) => x.id === run.id);
        r.stage = "compare";
        r.steps[0] = {
          ...r.steps[0],
          status: "done",
          finishedAt: stamp(),
          detail: `HTTP ${snapshot.httpStatus}; ${snapshot.components.length} components read.`,
        };
        r.steps.push({
          stage: "compare",
          status: "running",
          startedAt: stamp(),
        });
        event(s, run, "listen", r.steps[0].detail);
        return s;
      });
      const changes = compare(station.latest, snapshot);
      if (station.error)
        changes.unshift({
          kind: "feed",
          detail:
            "Feed collection restored. Provider status evaluated separately.",
        });
      await save((s) => {
        if (!valid(s)) throw Error("Station changed.");
        const r = s.runs.find((x) => x.id === run.id);
        r.stage = "record";
        r.steps[1] = {
          ...r.steps[1],
          status: "done",
          finishedAt: stamp(),
          detail: changes.length
            ? `${changes.length} observation changes.`
            : "No provider state changes.",
        };
        r.steps.push({
          stage: "record",
          status: "running",
          startedAt: stamp(),
        });
        event(s, run, "compare", r.steps[1].detail);
        return s;
      });
      await save((s) => {
        if (!valid(s)) throw Error("Station changed.");
        const current = s.stations.find((x) => x.id === station.id),
          r = s.runs.find((x) => x.id === run.id);
        current.latest = snapshot;
        current.lastChecked = snapshot.observedAt;
        current.error = null;
        current.history = [
          {
            id: snapshot.id,
            at: snapshot.observedAt,
            indicator: snapshot.indicator,
            durationMs: snapshot.durationMs,
          },
          ...current.history,
        ].slice(0, 96);
        r.snapshot = snapshot;
        r.changes = changes;
        r.status = "completed";
        r.finishedAt = stamp();
        r.steps[2] = {
          ...r.steps[2],
          status: "done",
          finishedAt: r.finishedAt,
          detail: "Observation and input checksum stored.",
        };
        event(s, run, "record", r.steps[2].detail);
        s.changes = [
          ...changes.map((change) => ({
            ...change,
            id: randomUUID(),
            stationId: station.id,
            runId: run.id,
            at: snapshot.observedAt,
          })),
          ...s.changes,
        ].slice(0, 200);
        return s;
      });
    } catch (e) {
      await save((s) => {
        const r = s.runs.find((x) => x.id === run.id),
          current = s.stations.find((x) => x.id === station.id),
          cancelled = !valid(s),
          message = cancelled
            ? "Station changed while collection was in flight."
            : /^Feed /.test(e.message)
              ? e.message
              : "Feed collection failed. Service state is unknown.";
        if (r) {
          r.status = cancelled ? "cancelled" : "failed";
          r.finishedAt = stamp();
          r.error = message;
          r.steps.at(-1).status = "failed";
          r.steps.at(-1).finishedAt = r.finishedAt;
          event(s, run, r.stage, message);
        }
        if (current && valid(s)) {
          if (!current.error)
            s.changes = [
              {
                id: randomUUID(),
                stationId: station.id,
                runId: run.id,
                at: stamp(),
                kind: "feed",
                detail: message,
              },
              ...s.changes,
            ].slice(0, 200);
          current.error = message;
          current.lastChecked = stamp();
          current.history = [
            {
              id: randomUUID(),
              at: stamp(),
              indicator: "unavailable",
              durationMs: null,
            },
            ...current.history,
          ].slice(0, 96);
        }
        return s;
      }).catch(() => {});
    }
  }
  const end = await save((s) => {
    s.lastBucket = bucket;
    s.lastCompleted = stamp();
    if (!manual) s.lastScheduledCompletion = s.lastCompleted;
    s.cycleCount++;
    s.lease = null;
    return s;
  });
  return {
    completedAt: end.lastCompleted,
    source: manual ? "operator" : "scheduler",
  };
}
