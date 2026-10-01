# BEACON

A small crew. Always on watch.

BEACON is a provider-status observation station with a native pixel-art interface. Three deterministic server agents collect official status summaries, compare observations and preserve source-linked records. It does not independently probe provider infrastructure or repair services.

## Local development

Node 24 is required.

```sh
npm ci
npm run dev
node scripts/provision.mjs
npm test
npm run qa
```

Local URL: http://127.0.0.1:5250. The local server generates `.local/dev-access.json`. The operator key unlocks station and token configuration. Never enter a wallet private key or seed.

## Agents and data

- Wick fetches a canonical HTTPS summary endpoint, rejects redirects, validates the provider page ID and known status schemas, and hashes the received body.
- Echo compares status, components, incidents and maintenance with the last completed observation. First reads are baselines. Removed incidents are not falsely labeled resolved.
- Log atomically commits the observation, run stages, change records and history. A missing feed becomes unavailable; the previous service observation is retained.

The curated catalog includes GitHub, npm, Solana and Vercel official status pages. No arbitrary URL or request headers can be configured. The fixed endpoint allowlist prevents the observer from becoming an arbitrary fetch proxy. Public data is displayed as text, not executable HTML. Provider names indicate sources, not partnerships.

Checks are scheduled every five minutes in production. A record older than twelve minutes is stale. The UI polls durable state, not providers. Collection latency measures the feed fetch, not underlying service response time. Missing samples are blank, not assumed uptime. No uptime percentage is calculated.

Operator controls can connect, pause, resume and remove stations. In-flight publication is guarded by configuration revisions. Per-cycle idempotency, strong-ETag compare-and-swap storage and expiring leases prevent duplicate or late writes. Production never falls back to ephemeral storage. Provider failures are recorded individually; an infrastructure failure expires the worker lease.

Limits: 4 catalog providers, 2 MB per feed, 200 components, 50 incidents and 50 maintenance records per summary. Retention: 96 samples per station, 80 runs, 200 stage events and 200 changes. Export JSON or Markdown for longer retention. The checksum fingerprints a response body; it is not a provider signature or audit.

## Deployment

```sh
node scripts/deploy.mjs
node scripts/provision.mjs --production
```

Set `VERCEL_TOKEN`, `VERCEL_TEAM_ID` and `VERCEL_SCOPE` in the process environment. The deploy script uses an existing Pro/Enterprise plan, provisions an isolated project and private Blob store, and preserves attached domains. It never upgrades the account. Production requires `BEACON_OPERATOR_KEY`, `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN` and `PUBLIC_ORIGIN` (or comma-separated `PUBLIC_ORIGINS`). Update the origin allowlist when attaching custom domains.

Private credentials are written to `operator-access.txt` and `.local/operator.json`, excluded from Git and deploy. The broad GitHub login is never deployed. `lastScheduledCompletion` reports an actual authenticated scheduler invocation, not just configured cron settings.

## Token monitor

CA remains `soon` until a dedicated public dev wallet is supplied and activated. Do not silently reuse another project's wallet. Activation records the current finalized Solana slot. The watcher accepts only future Pump creations named BEACON, matching the wallet's signer/user/creator role and an initialized six-decimal mint. It pins the earliest qualifying launch and never swaps it for a later transfer or launch.

Configure through Token monitor > Operator settings, or `node scripts/provision.mjs --production --wallet PUBLIC_ADDRESS`. Set `SOLANA_RPC_URL` for a dedicated mainnet RPC if necessary. Neither observation nor token discovery sends transactions or moves funds.

## Brand

`npm run assets` renders the code-native pixel artwork. `FFMPEG_PATH=/path/to/ffmpeg npm run assets -- --film` renders three eight-second H.264 videos. Brand assets are illustrations, not operational evidence. Marketing copy is in `marketing/POSTS.md`.

## Primary sources

- [GitHub Status API](https://www.githubstatus.com/api)
- [npm Status API](https://status.npmjs.org/api)
- [Solana Status API](https://status.solana.com/api)
- [Vercel Status API](https://www.vercel-status.com/api)
- [Pump instruction schemas](https://github.com/pump-fun/pump-public-docs/blob/main/idl/pump.json)

Independent, unaudited software. No availability, monitoring continuity, token value or investment outcome is guaranteed.
