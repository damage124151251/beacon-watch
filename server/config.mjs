export function station(id) {
  return {
    id,
    enabled: true,
    revision: 1,
    latest: null,
    lastChecked: null,
    error: null,
    history: [],
  };
}
export function initialState() {
  return {
    version: 1,
    revision: 1,
    paused: false,
    lease: null,
    lastBucket: null,
    lastCompleted: null,
    lastScheduledCompletion: null,
    cycleCount: 0,
    stations: ["github", "npm", "solana"].map(station),
    runs: [],
    events: [],
    changes: [],
    identitySettings: null,
    watchStatus: "unconfigured",
  };
}
