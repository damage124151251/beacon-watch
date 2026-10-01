import bs58 from "bs58";
export function addressValid(s) {
  try {
    return (
      typeof s === "string" && s.length <= 44 && bs58.decode(s).length === 32
    );
  } catch {
    return false;
  }
}
export function snapshotMarkdown(s) {
  return [
    `# BEACON / ${s.name}`,
    "",
    `Observed: ${s.observedAt}`,
    `Source: ${s.url}`,
    `Provider status: ${s.description}`,
    `Feed response: HTTP ${s.httpStatus}`,
    `Feed fetch time: ${s.durationMs} ms`,
    `Provider updated: ${s.providerUpdatedAt}`,
    `Input SHA-256: ${s.inputHash}`,
    "",
    "## Components",
    ...s.components.map((c) => `- ${c.name}: ${c.status}`),
    "",
    "## Provider incidents",
    ...(s.incidents.length
      ? s.incidents.map((i) => `- ${i.name}: ${i.status}`)
      : ["No unresolved incidents in this observation."]),
    "",
    "## Scheduled maintenance",
    ...(s.maintenance.length
      ? s.maintenance.map(
          (m) =>
            `- ${m.name}: ${m.status} (${m.scheduledFor || "time not supplied"})`,
        )
      : ["No scheduled maintenance in this observation."]),
    "",
    "An observed provider status, not an independent service availability measurement. Fetch latency measures the status feed, not the underlying service.",
  ].join("\n");
}
