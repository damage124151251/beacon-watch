import { readFile } from "node:fs/promises";
const prod = process.argv.includes("--production"),
  base = prod ? "https://beacon-watch.vercel.app" : "http://127.0.0.1:5250";
const keys = JSON.parse(
  await readFile(
    new URL(
      prod ? "../.local/operator.json" : "../.local/dev-access.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
async function call(input) {
  const r = await fetch(base + "/api/operator", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${keys.operator}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(58000),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error);
  return d;
}
const i = process.argv.indexOf("--wallet");
if (i >= 0) {
  console.log(
    await call({ action: "set-wallet", wallet: process.argv[i + 1] }),
  );
  console.log(await call({ action: "watch" }));
}
console.log(await call({ action: "run" }));
const s = await fetch(base + "/api/status").then((r) => r.json());
console.log(
  JSON.stringify(
    {
      stations: s.stations.map((x) => ({
        id: x.id,
        state: x.visibleStatus,
        observedAt: x.latest?.observedAt,
        error: x.error,
        checksum: x.latest?.inputHash,
      })),
      runs: s.runs.length,
      lastScheduledCompletion: s.lastScheduledCompletion,
      identity: s.identity,
    },
    null,
    2,
  ),
);
