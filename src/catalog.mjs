export const CATALOG = [
  {
    id: "github",
    name: "GitHub",
    kind: "Developer platform",
    pageId: "kctbh9vrtdwd",
    url: "https://www.githubstatus.com",
    color: "#edc967",
  },
  {
    id: "npm",
    name: "npm",
    kind: "Package registry",
    pageId: "wyvgptkd90hm",
    url: "https://status.npmjs.org",
    color: "#eb7564",
  },
  {
    id: "solana",
    name: "Solana",
    kind: "Network services",
    pageId: "rm9mn997x8jd",
    url: "https://status.solana.com",
    color: "#74c6be",
  },
  {
    id: "vercel",
    name: "Vercel",
    kind: "Application platform",
    pageId: "lvglq8h0mdyh",
    url: "https://www.vercel-status.com",
    color: "#c4c8bd",
  },
];
export const provider = (id) => CATALOG.find((p) => p.id === id);
export const endpoint = (id) => {
  const p = provider(id);
  if (!p) throw Error("Invalid station.");
  return p.url + "/api/v2/summary.json";
};
export const labels = {
  none: "Operational",
  minor: "Degraded",
  major: "Major issue",
  critical: "Critical issue",
  unknown: "No observation",
  unavailable: "Feed unavailable",
  stale: "Observation stale",
  paused: "Paused",
};
export function visibleStatus(station, now = Date.now()) {
  if (!station.enabled) return "paused";
  if (!station.latest) return station.error ? "unavailable" : "unknown";
  if (now - Date.parse(station.latest.observedAt) > 12 * 60000) return "stale";
  if (station.error) return "unavailable";
  return station.latest.indicator;
}
