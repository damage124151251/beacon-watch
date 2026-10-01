import { createHash, randomUUID } from "node:crypto";
import { provider, endpoint } from "../src/catalog.mjs";
const indicators = ["none", "minor", "major", "critical"];
const components = [
  "operational",
  "degraded_performance",
  "partial_outage",
  "major_outage",
  "under_maintenance",
];
const incidentStates = [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
  "postmortem",
];
const maintenanceStates = [
  "scheduled",
  "in_progress",
  "verifying",
  "completed",
];
const text = (s, max = 240) => {
  if (typeof s !== "string" || !s.trim() || s.length > max)
    throw Error("Feed data is invalid.");
  return s;
};
const identifier = (s) => {
  if (typeof s !== "string" || !/^[-a-zA-Z0-9_]{1,64}$/.test(s))
    throw Error("Feed data is invalid.");
  return s;
};
const timestamp = (s) => {
  if (typeof s !== "string" || !Number.isFinite(Date.parse(s)))
    throw Error("Feed timestamp is invalid.");
  return s;
};
export function normalizeSnapshot(
  id,
  data,
  {
    observedAt = new Date().toISOString(),
    durationMs = 0,
    inputHash = "",
  } = {},
) {
  const p = provider(id);
  if (!p || data?.page?.id !== p.pageId) throw Error("Feed identity mismatch.");
  if (!indicators.includes(data?.status?.indicator))
    throw Error("Feed status is invalid.");
  if (
    !Array.isArray(data.components) ||
    data.components.length > 200 ||
    !Array.isArray(data.incidents) ||
    data.incidents.length > 50 ||
    !Array.isArray(data.scheduled_maintenances) ||
    data.scheduled_maintenances.length > 50
  )
    throw Error("Feed coverage is invalid.");
  const items = data.components
    .map((c) => {
      if (!components.includes(c.status))
        throw Error("Feed component status is invalid.");
      return {
        id: identifier(c.id),
        name: text(c.name),
        status: c.status,
        group: !!c.group,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(items.map((c) => c.id)).size !== items.length)
    throw Error("Feed contains duplicate components.");
  const incidents = data.incidents
    .map((i) => {
      if (!incidentStates.includes(i.status))
        throw Error("Feed incident status is invalid.");
      return {
        id: identifier(i.id),
        name: text(i.name),
        status: i.status,
        updatedAt: timestamp(i.updated_at),
        url: p.url + "/incidents/" + identifier(i.id),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const maintenance = data.scheduled_maintenances
    .map((m) => {
      if (!maintenanceStates.includes(m.status))
        throw Error("Feed maintenance status is invalid.");
      return {
        id: identifier(m.id),
        name: text(m.name),
        status: m.status,
        scheduledFor: m.scheduled_for ? timestamp(m.scheduled_for) : null,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    id: randomUUID(),
    stationId: id,
    name: p.name,
    url: endpoint(id),
    observedAt: timestamp(observedAt),
    providerUpdatedAt: timestamp(data.page.updated_at),
    indicator: data.status.indicator,
    description: text(data.status.description),
    httpStatus: 200,
    durationMs: Math.max(0, Math.round(durationMs)),
    components: items,
    incidents,
    maintenance,
    inputHash,
  };
}
export function createObserver({ fetcher = fetch, now = Date.now } = {}) {
  const deadline = now() + 45000;
  return async (id) => {
    const url = endpoint(id),
      start = now(),
      remaining = deadline - start;
    if (remaining <= 0) throw Error("Feed collection deadline exceeded.");
    const r = await fetcher(url, {
      redirect: "error",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "BEACON-service-observer",
      },
      signal: AbortSignal.timeout(Math.min(8000, remaining)),
    });
    if (r.status !== 200) {
      await r.body?.cancel();
      throw Error(`Feed returned HTTP ${r.status}. Service state is unknown.`);
    }
    if (Number(r.headers.get("content-length")) > 2e6) {
      await r.body?.cancel();
      throw Error("Feed response exceeds the size limit.");
    }
    if (!r.body) throw Error("Feed response is empty.");
    const reader = r.body.getReader(),
      parts = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2e6) {
        await reader.cancel();
        throw Error("Feed response exceeds the size limit.");
      }
      parts.push(value);
    }
    const raw = Buffer.concat(parts);
    let data;
    try {
      data = JSON.parse(raw.toString("utf8"));
    } catch {
      throw Error("Feed response is not JSON.");
    }
    return normalizeSnapshot(id, data, {
      observedAt: new Date(now()).toISOString(),
      durationMs: now() - start,
      inputHash: createHash("sha256").update(raw).digest("hex"),
    });
  };
}
export function compare(previous, next) {
  if (!previous)
    return [
      { kind: "baseline", detail: `First observation: ${next.description}.` },
    ];
  const changes = [];
  if (previous.indicator !== next.indicator)
    changes.push({
      kind: next.indicator === "none" ? "recovery" : "status",
      detail: `Provider status: ${previous.indicator} -> ${next.indicator}.`,
    });
  const prior = new Map(previous.components.map((c) => [c.id, c]));
  for (const item of next.components) {
    const old = prior.get(item.id);
    if (!old)
      changes.push({
        kind: "component",
        detail: `Component added: ${item.name}.`,
      });
    else if (old.status !== item.status)
      changes.push({
        kind: "component",
        detail: `${item.name}: ${old.status} -> ${item.status}.`,
      });
    prior.delete(item.id);
  }
  for (const item of prior.values())
    changes.push({
      kind: "component",
      detail: `Component removed from feed: ${item.name}.`,
    });
  const incidents = new Map(previous.incidents.map((i) => [i.id, i]));
  for (const item of next.incidents) {
    const old = incidents.get(item.id);
    if (!old || old.status !== item.status || old.updatedAt !== item.updatedAt)
      changes.push({
        kind: "incident",
        detail: `${item.name}: ${item.status}.`,
        url: item.url,
      });
    incidents.delete(item.id);
  }
  for (const item of incidents.values())
    changes.push({
      kind: "incident",
      detail: `No longer in the provider summary: ${item.name}.`,
      url: item.url,
    });
  if (JSON.stringify(previous.maintenance) !== JSON.stringify(next.maintenance))
    changes.push({
      kind: "maintenance",
      detail: "Provider maintenance schedule changed.",
    });
  return changes;
}
