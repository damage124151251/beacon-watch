import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Radio,
  TowerControl,
  ScrollText,
  BookOpen,
  Github,
  KeyRound,
  ArrowUpRight,
  RefreshCw,
  Play,
  Pause,
  Plus,
  Trash2,
  Download,
  FileText,
  Check,
  Clock3,
  Search,
  RotateCcw,
  AlertTriangle,
  ChevronRight,
  Settings2,
  ExternalLink,
} from "lucide-react";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/silkscreen/400.css";
import { CREW, GITHUB_URL, X_URL } from "./config.mjs";
import { CATALOG, provider, visibleStatus, labels } from "./catalog.mjs";
import { addressValid, snapshotMarkdown } from "./domain.mjs";
import {
  Canvas,
  Mark,
  IconButton,
  CopyButton,
  External,
  Modal,
  Intro,
  useReducedMotion,
} from "./components.jsx";
import { drawLandscape, drawKeeper } from "./art.mjs";
import "./style.css";
const date = (s) =>
  s
    ? new Date(s).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "Not recorded";
const age = (s) => {
  if (!s) return "No check yet";
  const d = Math.max(0, Math.floor((Date.now() - Date.parse(s)) / 1000));
  return d < 60
    ? `${d}s ago`
    : d < 3600
      ? `${Math.floor(d / 60)}m ago`
      : `${Math.floor(d / 3600)}h ago`;
};
const short = (s) => (s ? `${s.slice(0, 5)}...${s.slice(-5)}` : "soon");
function download(data, name, type = "application/json") {
  const url = URL.createObjectURL(
      new Blob(
        [type === "application/json" ? JSON.stringify(data, null, 2) : data],
        { type },
      ),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function request(path, options = {}) {
  const r = await fetch(path, {
    ...options,
    signal: AbortSignal.timeout(58000),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Request unavailable.");
  return d;
}
function App() {
  const [view, setView] = useState("overview"),
    [data, setData] = useState(null),
    [selected, setSelected] = useState("github"),
    [modal, setModal] = useState(null),
    [operator, setOperator] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [replay, setReplay] = useState(null),
    [, setClock] = useState(0);
  const [intro, setIntro] = useState(() => {
      try {
        return (
          !matchMedia("(prefers-reduced-motion: reduce)").matches &&
          !sessionStorage.getItem("beacon-arrived")
        );
      } catch {
        return false;
      }
    }),
    heading = useRef(),
    fetching = useRef(false),
    state = useRef(null),
    reduced = useReducedMotion();
  state.current = data;
  const refresh = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      setData(await request("/api/status"));
      setError("");
    } catch {
      setError(
        "Connection interrupted. Showing previously received observations.",
      );
    } finally {
      fetching.current = false;
    }
  }, []);
  useEffect(() => {
    refresh();
    let t = 0;
    const timer = setInterval(() => {
        setClock((x) => x + 1);
        t++;
        if (
          !document.hidden &&
          (state.current?.running ? t % 2 === 0 : t % 30 === 0)
        )
          refresh();
      }, 1000),
      visible = () => {
        if (!document.hidden) refresh();
      };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  useEffect(() => {
    if (notice) {
      const id = setTimeout(() => setNotice(""), 4500);
      return () => clearTimeout(id);
    }
  }, [notice]);
  useEffect(() => {
    if (replay) {
      const id = setTimeout(() => setReplay(null), 7200);
      return () => clearTimeout(id);
    }
  }, [replay]);
  const done = () => {
    try {
      sessionStorage.setItem("beacon-arrived", "1");
    } catch {}
    setIntro(false);
    setTimeout(() => heading.current?.focus(), 0);
  };
  const nav = (v) => {
    setView(v);
    setReplay(null);
    window.scrollTo({ top: 0, behavior: "instant" });
    setTimeout(() => heading.current?.focus(), 0);
  };
  const act = async (input) => {
    if (!operator) {
      setModal({ type: "auth" });
      return false;
    }
    setBusy(true);
    try {
      const r = await request("/api/operator", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${operator}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
      await refresh();
      setNotice(r.skipped ? r.reason || "No new work." : "Change recorded.");
      return true;
    } catch (e) {
      setNotice(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const stations = (data?.stations || []).map((s) => ({
      ...s,
      ...provider(s.id),
      visibleStatus: visibleStatus(s),
    })),
    station = stations.find((s) => s.id === selected) || stations[0],
    runs = data?.runs || [],
    identity = data?.identity || {},
    active = replay
      ? {
          stationId: replay.stationId,
          stage:
            CREW[Math.min(2, Math.floor((Date.now() - replay.at) / 2400))].id,
        }
      : runs.find((r) => r.status === "running"),
    latestRun = runs.find((r) => r.stationId === station?.id && r.snapshot);
  const scheduled =
      data?.lastScheduledCompletion &&
      Date.now() - Date.parse(data.lastScheduledCompletion) < 12 * 60000,
    icons = {
      overview: TowerControl,
      stations: Radio,
      journal: ScrollText,
      guide: BookOpen,
    },
    navNames = {
      overview: "Overview",
      stations: "Stations",
      journal: "Journal",
      guide: "Field guide",
    };
  return (
    <>
      <div className="shell" inert={intro ? true : undefined}>
        <aside className="rail">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              nav("overview");
            }}
          >
            <Mark />
            <span>BEACON</span>
          </a>
          <span className="rail-caption">Signal station</span>
          <nav aria-label="Main navigation">
            {Object.entries(navNames).map(([id, name]) => {
              const Icon = icons[id];
              return (
                <button
                  key={id}
                  aria-current={view === id ? "page" : undefined}
                  aria-label={name}
                  className={view === id ? "current" : ""}
                  onClick={() => nav(id)}
                >
                  <Icon size={17} />
                  <span>{name}</span>
                  {id === "stations" && <small>{stations.length}</small>}
                </button>
              );
            })}
          </nav>
          <div className="rail-crew">
            <Canvas
              animate
              label="Wick, the BEACON signal keeper"
              draw={(c, w, h, t) => {
                c.clearRect(0, 0, w, h);
                drawKeeper(c, w / 2, h - 12, 2.6, {
                  time: t,
                  walk: active?.stage === "listen",
                });
              }}
            />
            <span>Wick is {active ? "on a check" : "on watch"}.</span>
            <span className="rail-crew-clock">
              {data?.paused
                ? "Collection paused"
                : scheduled
                  ? "Scheduled every 5 min"
                  : "Awaiting scheduled check"}
            </span>
          </div>
          <div className="rail-bottom">
            <External href={identity.github || GITHUB_URL}>
              <Github size={15} />
              GitHub
            </External>
            <External
              href={identity.x || X_URL}
              title="BEACON on X (@agentsbeacon)"
            >
              <span className="x-symbol" aria-hidden="true">X</span>
              Follow on X
            </External>
            <button onClick={() => setModal({ type: "token" })}>
              <Radio size={15} />
              <span>CA {short(identity.tokenCA)}</span>
            </button>
            <button
              onClick={() => setModal({ type: operator ? "session" : "auth" })}
            >
              <KeyRound size={15} />
              {operator ? "Operator session" : "Operator access"}
            </button>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <span>
              <span
                className={`signal-dot ${data?.running ? "amber" : scheduled ? "aqua" : ""}`}
              />
              {error
                ? "Connection interrupted"
                : data?.paused
                  ? "Station paused"
                  : data?.running
                    ? "Crew on a check"
                    : scheduled
                      ? "The watch is on"
                      : "Observation station"}
            </span>
            <div>
              <span className="last-check">{age(data?.lastCompleted)}</span>
              <IconButton title="Refresh readings" onClick={refresh}>
                <RefreshCw size={15} />
              </IconButton>
              <button
                className="run-button"
                disabled={busy}
                onClick={() => act({ action: "run" })}
              >
                <Play size={12} />
                {busy ? "Checking..." : "Run a check"}
              </button>
            </div>
          </header>
          <main>
            <div className="page-title">
              <div>
                <p>
                  {view === "overview"
                    ? "A small crew. Always on watch."
                    : `BEACON / ${navNames[view]}`}
                </p>
                <h1 ref={heading} tabIndex={-1}>
                  {view === "overview"
                    ? "Keep a light on."
                    : view === "stations"
                      ? "Every source, in sight."
                      : view === "journal"
                        ? "The observation log."
                        : "Inside the station."}
                </h1>
              </div>
              {view === "overview" ? (
                <div className="title-metric">
                  <b>
                    {stations.filter((s) => s.visibleStatus === "none").length}
                    <span> / {stations.length}</span>
                  </b>
                  <span>reported operational</span>
                </div>
              ) : view === "stations" ? (
                <button
                  className="primary"
                  onClick={() => setModal({ type: operator ? "add" : "auth" })}
                >
                  <Plus size={15} />
                  Connect station
                </button>
              ) : null}
            </div>
            {error && (
              <div className="error-banner" role="alert">
                <AlertTriangle size={15} />
                {error}
                <button onClick={refresh}>Retry</button>
              </div>
            )}
            {view === "overview" && (
              <>
                <div className="watch-layout">
                  <section className="map-section">
                    <div className="section-bar">
                      <h2>The signal field</h2>
                      <span>
                        {replay
                          ? "Historical workflow replay"
                          : active
                            ? `${CREW.find((a) => a.id === active.stage)?.name} / ${active.stage}`
                            : "Between checks"}
                      </span>
                      <IconButton
                        title="Replay opening"
                        onClick={() => setIntro(true)}
                      >
                        <RotateCcw size={14} />
                      </IconButton>
                    </div>
                    <div className="landscape">
                      <Canvas
                        animate
                        label="BEACON signal tower linked to monitored service stations"
                        className="landscape-canvas"
                        draw={(c, w, h, t) =>
                          drawLandscape(c, w, h, {
                            time: t,
                            stations,
                            selected: station?.id,
                            active,
                            reduced,
                          })
                        }
                      />
                      {stations.slice(0, 4).map((s, i) => (
                        <button
                          key={s.id}
                          className={`map-hit map-hit-${i}`}
                          aria-label={`Inspect ${s.name}`}
                          title={`${s.name}: ${labels[s.visibleStatus]}`}
                          aria-pressed={station?.id === s.id}
                          onClick={() => setSelected(s.id)}
                        />
                      ))}
                    </div>
                    <div className="map-legend">
                      <span>
                        <i className="signal-dot aqua" />
                        Operational
                      </span>
                      <span>
                        <i className="signal-dot red" />
                        Reported issue
                      </span>
                      <span>
                        <i className="signal-dot" />
                        Unknown / paused
                      </span>
                    </div>
                    <div className="crew-row">
                      {CREW.map((a, i) => (
                        <button
                          key={a.id}
                          onClick={() =>
                            setModal({ type: "crew", agent: a, index: i })
                          }
                        >
                          <i style={{ background: a.color }} />
                          <span>
                            <b>{a.name}</b>
                            <small>{a.role}</small>
                          </span>
                          <span
                            className={
                              active?.stage === a.id ? "crew-active" : ""
                            }
                          >
                            {active?.stage === a.id
                              ? replay
                                ? "replay"
                                : "working"
                              : "ready"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                  <aside className="station-inspector">
                    {station ? (
                      <>
                        <div className="section-bar">
                          <span>Selected station</span>
                          <External href={station.url}>
                            Status page
                          </External>
                        </div>
                        <div className="station-name">
                          <h2>{station.name}</h2>
                          <span>{station.kind}</span>
                        </div>
                        <Status value={station.visibleStatus} />
                        <p className="station-description">
                          {station.error ||
                            station.latest?.description ||
                            "Awaiting its first recorded observation."}
                        </p>
                        <dl className="metrics">
                          <dt>Observed</dt>
                          <dd>{age(station.latest?.observedAt)}</dd>
                          <dt>Feed fetch</dt>
                          <dd>
                            {station.latest
                              ? `${station.latest.durationMs} ms`
                              : "--"}
                          </dd>
                          <dt>Components</dt>
                          <dd>{station.latest?.components.length ?? "--"}</dd>
                          <dt>Open incidents in feed</dt>
                          <dd>{station.latest?.incidents.length ?? "--"}</dd>
                        </dl>
                        <div className="mini-history">
                          <span>Recent observations</span>
                          <History values={station.history} />
                          <span>
                            Oldest <i /> Latest
                          </span>
                        </div>
                        <div className="inspector-actions">
                          <button
                            className="primary"
                            disabled={!station.latest}
                            onClick={() =>
                              setModal({
                                type: "snapshot",
                                snapshot: station.latest,
                              })
                            }
                          >
                            <FileText size={14} />
                            Observation
                          </button>
                          <IconButton
                            title="Replay recorded workflow"
                            disabled={!latestRun}
                            onClick={() =>
                              setReplay({
                                at: Date.now(),
                                stationId: station.id,
                              })
                            }
                          >
                            <Play size={15} />
                          </IconButton>
                        </div>
                        <p className="caption">
                          Provider-reported state. Fetch time measures the
                          status feed.
                        </p>
                      </>
                    ) : (
                      <Empty
                        title="No stations connected"
                        text="Connect a provider to start observing."
                      />
                    )}
                  </aside>
                </div>
                <section className="readings">
                  <div className="section-bar">
                    <h2>Observed readings</h2>
                    <button
                      className="text-link"
                      onClick={() => nav("stations")}
                    >
                      Manage stations <ArrowUpRight size={13} />
                    </button>
                  </div>
                  <div className="reading-head">
                    <span>Station</span>
                    <span>Provider status</span>
                    <span>Feed fetch</span>
                    <span>Observed</span>
                    <span />
                  </div>
                  {stations.map((s) => (
                    <button
                      className="reading-row"
                      key={s.id}
                      onClick={() => {
                        setSelected(s.id);
                        setModal(
                          s.latest
                            ? { type: "snapshot", snapshot: s.latest }
                            : { type: "station", station: s },
                        );
                      }}
                    >
                      <span>
                        <i style={{ background: s.color }} />
                        {s.name}
                      </span>
                      <Status value={s.visibleStatus} />
                      <span>
                        {s.latest ? `${s.latest.durationMs} ms` : "--"}
                      </span>
                      <span>{age(s.latest?.observedAt)}</span>
                      <ChevronRight size={14} />
                    </button>
                  ))}
                  {!stations.length && (
                    <Empty
                      title="The field is quiet."
                      text="No providers are connected."
                    />
                  )}
                </section>
                <div className="lower-grid">
                  <section>
                    <div className="section-bar">
                      <h2>Signal journal</h2>
                      <button
                        className="text-link"
                        onClick={() => nav("journal")}
                      >
                        All records <ArrowUpRight size={13} />
                      </button>
                    </div>
                    <Changes
                      items={(data?.changes || []).slice(0, 5)}
                      onSelect={(id) => {
                        const r = runs.find((r) => r.id === id);
                        if (r) setModal({ type: "run", run: r });
                        else
                          setNotice(
                            "This run is outside retained history. The change record remains available.",
                          );
                      }}
                    />
                  </section>
                  <section className="handoffs">
                    <div className="section-bar">
                      <h2>Crew handoffs</h2>
                      <span>Recorded events</span>
                    </div>
                    {(data?.events || []).slice(0, 4).map((e) => (
                      <div key={e.id}>
                        <span>{CREW.find((a) => a.id === e.stage)?.name}</span>
                        <p>{e.detail}</p>
                        <time>{age(e.at)}</time>
                      </div>
                    ))}
                    {!data?.events?.length && (
                      <Empty
                        title="No handoffs yet"
                        text="The first collection creates its own record."
                      />
                    )}
                  </section>
                </div>
              </>
            )}
            {view === "stations" && (
              <>
                <div className="station-directory">
                  {stations.map((s) => (
                    <article key={s.id}>
                      <div className="station-directory-head">
                        <div>
                          <span className="station-id">{s.id}</span>
                          <h2>{s.name}</h2>
                        </div>
                        <Status value={s.visibleStatus} />
                        <div className="station-tools">
                          <IconButton
                            title={`${s.enabled ? "Pause" : "Resume"} ${s.name}`}
                            disabled={busy}
                            onClick={() =>
                              act({
                                action: "toggle-station",
                                id: s.id,
                                enabled: !s.enabled,
                              })
                            }
                          >
                            {s.enabled ? (
                              <Pause size={15} />
                            ) : (
                              <Play size={15} />
                            )}
                          </IconButton>
                          <IconButton
                            title={`Remove ${s.name}`}
                            onClick={() =>
                              setModal({
                                type: operator ? "remove" : "auth",
                                station: s,
                              })
                            }
                          >
                            <Trash2 size={15} />
                          </IconButton>
                        </div>
                      </div>
                      <div className="station-directory-body">
                        <div>
                          <External href={s.url}>
                            {new URL(s.url).hostname}
                          </External>
                          <p>
                            {s.error ||
                              s.latest?.description ||
                              "No observation yet"}
                          </p>
                        </div>
                        <div className="directory-history">
                          <History values={s.history} />
                          <span>{s.history.length} retained observations</span>
                        </div>
                        <button
                          className="outline"
                          disabled={!s.latest}
                          onClick={() =>
                            setModal({ type: "snapshot", snapshot: s.latest })
                          }
                        >
                          <FileText size={14} />
                          View evidence
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                {!stations.length && (
                  <Empty
                    title="Connect your first station"
                    text="Official status feeds are available in the provider catalog."
                  />
                )}
                <div className="directory-footer">
                  <span>
                    {stations.length} / {CATALOG.length} providers connected
                  </span>
                  <button
                    className="outline"
                    disabled={busy}
                    onClick={() =>
                      act({ action: "pause", paused: !data?.paused })
                    }
                  >
                    {data?.paused ? <Play size={13} /> : <Pause size={13} />}{" "}
                    {data?.paused ? "Resume collection" : "Pause collection"}
                  </button>
                </div>
              </>
            )}
            {view === "journal" && (
              <>
                <div className="journal-tools">
                  <div className="segmented" aria-label="Record filter">
                    {["all", "completed", "failed"].map((v) => (
                      <button
                        aria-pressed={filter === v}
                        key={v}
                        onClick={() => setFilter(v)}
                      >
                        {v === "all"
                          ? "All checks"
                          : v === "completed"
                            ? "Recorded"
                            : "Collection failed"}
                      </button>
                    ))}
                  </div>
                  <label className="search">
                    <Search size={14} />
                    <input
                      aria-label="Search station"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Find a station"
                    />
                  </label>
                  <IconButton
                    title="Export observation history"
                    onClick={() =>
                      download(
                        {
                          exportedAt: new Date().toISOString(),
                          runs,
                          changes: data?.changes || [],
                        },
                        "beacon-observations.json",
                      )
                    }
                  >
                    <Download size={16} />
                  </IconButton>
                </div>
                <div className="journal-list">
                  {runs
                    .filter(
                      (r) =>
                        (filter === "all" || r.status === filter) &&
                        (provider(r.stationId)?.name || r.stationId)
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                    )
                    .map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setModal({ type: "run", run: r })}
                      >
                        <span className={`run-icon ${r.status}`}>
                          {r.status === "completed" ? (
                            <Check size={16} />
                          ) : r.status === "running" ? (
                            <Activity size={16} />
                          ) : (
                            <AlertTriangle size={16} />
                          )}
                        </span>
                        <span>
                          <strong>
                            {provider(r.stationId)?.name || r.stationId}
                          </strong>
                          <small>
                            {r.error ||
                              r.snapshot?.description ||
                              "Collection in progress"}
                          </small>
                        </span>
                        <span className="journal-result">
                          {r.status === "completed"
                            ? r.changes.length
                              ? `${r.changes.length} changes`
                              : "No change"
                            : r.status}
                        </span>
                        <time>{date(r.startedAt)}</time>
                        <ChevronRight size={14} />
                      </button>
                    ))}
                </div>
                {!runs.filter(
                  (r) =>
                    (filter === "all" || r.status === filter) &&
                    (provider(r.stationId)?.name || r.stationId)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                ).length && (
                  <Empty
                    title="No matching records"
                    text="Try another station or record filter."
                  />
                )}
                <p className="caption">
                  Last {runs.length} retained checks. Unknown periods are never
                  counted as uptime.
                </p>
              </>
            )}
            {view === "guide" && <Guide />}
          </main>
          <footer>
            <span>
              <i className="signal-dot amber" />
              BEACON
            </span>
            <span>Public signals. Observable work.</span>
            <button onClick={() => setModal({ type: "token" })}>
              CA {short(identity.tokenCA)} <Radio size={12} />
            </button>
          </footer>
        </div>
      </div>
      {intro && <Intro onDone={done} />}{" "}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {modal?.type === "auth" && (
        <Auth
          onClose={() => setModal(null)}
          onSuccess={(key) => {
            setOperator(key);
            setModal(null);
            setNotice("Operator controls unlocked.");
          }}
        />
      )}
      {modal?.type === "session" && (
        <Modal title="Operator session" onClose={() => setModal(null)}>
          <p className="dialog-copy">Access is held in this tab only.</p>
          <button
            className="primary full"
            onClick={() => {
              setOperator("");
              setModal(null);
            }}
          >
            Lock controls
          </button>
        </Modal>
      )}
      {modal?.type === "add" && (
        <Modal title="Connect a station" onClose={() => setModal(null)}>
          <div className="catalog">
            {CATALOG.map((p) => {
              const exists = stations.some((s) => s.id === p.id);
              return (
                <button
                  key={p.id}
                  disabled={exists || busy}
                  onClick={async () => {
                    if (await act({ action: "add-station", id: p.id }))
                      setModal(null);
                  }}
                >
                  <Radio size={19} />
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.kind}</small>
                  </span>
                  {exists ? <Check size={17} /> : <Plus size={17} />}
                </button>
              );
            })}
          </div>
          <p className="caption">
            Official public status feeds. Connected providers and observations
            are public.
          </p>
        </Modal>
      )}
      {modal?.type === "remove" && (
        <Modal title="Disconnect station" onClose={() => setModal(null)}>
          <p className="dialog-copy">
            Disconnect {modal.station.name}? New checks will stop. Existing
            journal records are retained.
          </p>
          <button
            className="danger full"
            disabled={busy}
            onClick={async () => {
              if (await act({ action: "remove-station", id: modal.station.id }))
                setModal(null);
            }}
          >
            <Trash2 size={15} />
            Disconnect {modal.station.name}
          </button>
        </Modal>
      )}
      {modal?.type === "snapshot" && (
        <Observation snapshot={modal.snapshot} onClose={() => setModal(null)} />
      )}
      {modal?.type === "run" && (
        <RunModal
          run={modal.run}
          onClose={() => setModal(null)}
          onSnapshot={(snapshot) => setModal({ type: "snapshot", snapshot })}
        />
      )}
      {modal?.type === "station" && (
        <Modal title={modal.station.name} onClose={() => setModal(null)}>
          <p className="dialog-copy">
            {modal.station.error || "No observation has been recorded yet."}
          </p>
          <External href={modal.station.url}>Official status page</External>
        </Modal>
      )}
      {modal?.type === "crew" && (
        <Modal
          title={`${modal.agent.name} / ${modal.agent.role}`}
          onClose={() => setModal(null)}
        >
          <Canvas
            animate
            label={`${modal.agent.name} pixel agent`}
            className="crew-portrait"
            draw={(c, w, h, t) => {
              c.clearRect(0, 0, w, h);
              drawKeeper(c, w / 2, h - 12, 4, { time: t, kind: modal.index });
            }}
          />
          <p className="dialog-copy">
            {
              [
                "Wick fetches the official status summary and checks its provider identity, response and schema. A missing feed is recorded as unknown, not as a service outage.",
                "Echo compares the new observation with the last completed one. Provider status, component changes, incidents and maintenance are evaluated independently.",
                "Log records the observation, source, collection time and SHA-256 input checksum. Each published observation stays attached to its actual run.",
              ][modal.index]
            }
          </p>
          <p className="caption">
            Deterministic server-side agent. No LLM inference or automated
            repair.
          </p>
        </Modal>
      )}
      {modal?.type === "token" && (
        <TokenMonitor
          identity={identity}
          operator={operator}
          busy={busy}
          act={act}
          onClose={() => setModal(null)}
          onAuth={() => setModal({ type: "auth" })}
        />
      )}
    </>
  );
}
function Status({ value }) {
  return (
    <span className={`status status-${value}`}>
      <i />
      {labels[value] || value}
    </span>
  );
}
function History({ values = [] }) {
  const slots = [
    ...Array(Math.max(0, 32 - values.length)).fill(null),
    ...values.slice(0, 32).reverse(),
  ];
  return (
    <div
      className="history"
      role="img"
      aria-label={`${values.length} recorded observations`}
    >
      {slots.map((s, i) => (
        <span
          key={s?.id || i}
          className={s ? `history-${s.indicator}` : ""}
          title={
            s ? `${date(s.at)}: ${labels[s.indicator]}` : "No recorded sample"
          }
        />
      ))}
    </div>
  );
}
function Empty({ title, text }) {
  return (
    <div className="empty">
      <Radio size={25} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function Changes({ items, onSelect }) {
  return (
    <div className="changes">
      {items.length ? (
        items.map((e) => (
          <button key={e.id} onClick={() => onSelect(e.runId)}>
            <i
              className={`signal-dot ${e.kind === "status" ? "red" : e.kind === "recovery" ? "aqua" : "amber"}`}
            />
            <span>
              <strong>{provider(e.stationId)?.name || e.stationId}</strong>
              <span>{e.detail}</span>
            </span>
            <time>{age(e.at)}</time>
          </button>
        ))
      ) : (
        <Empty
          title="No recorded changes"
          text="The next observation will be compared with the last one."
        />
      )}
    </div>
  );
}
function Auth({ onClose, onSuccess }) {
  const [key, set] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Operator access" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await request("/api/operator", {
              headers: { Authorization: `Bearer ${key.trim()}` },
            });
            onSuccess(key.trim());
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Operator key
          <input
            autoFocus
            required
            minLength={32}
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => set(e.target.value)}
          />
        </label>
        <p className="caption">Never enter a wallet seed or private key.</p>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary full" disabled={busy}>
          <KeyRound size={14} />
          {busy ? "Checking..." : "Unlock controls"}
        </button>
      </form>
    </Modal>
  );
}
function Observation({ snapshot: s, onClose }) {
  return (
    <Modal title={`${s.name} observation`} wide onClose={onClose}>
      <div className="observation-heading">
        <Status value={s.indicator} />
        <span>{date(s.observedAt)}</span>
      </div>
      <h3>{s.description}</h3>
      <dl className="details">
        <dt>Source</dt>
        <dd>
          <External href={s.url}>Official summary</External>
        </dd>
        <dt>Feed fetch</dt>
        <dd>
          {s.durationMs} ms / HTTP {s.httpStatus}
        </dd>
        <dt>Provider updated</dt>
        <dd>{date(s.providerUpdatedAt)}</dd>
        <dt>Input SHA-256</dt>
        <dd>
          <code>{s.inputHash}</code>
        </dd>
      </dl>
      <h4>
        Components <span>{s.components.length}</span>
      </h4>
      <div className="components-list">
        {s.components.map((c) => (
          <div key={c.id}>
            <span>{c.name}</span>
            <span
              className={
                c.status === "operational" ? "aqua-text" : "amber-text"
              }
            >
              {c.status.replaceAll("_", " ")}
            </span>
          </div>
        ))}
      </div>
      <h4>Incidents in this summary</h4>
      {s.incidents.length ? (
        s.incidents.map((i) => (
          <div className="incident" key={i.id}>
            <External href={i.url}>{i.name}</External>
            <span>{i.status}</span>
          </div>
        ))
      ) : (
        <p className="caption">
          No unresolved incidents reported in this observation.
        </p>
      )}
      <h4>Scheduled maintenance</h4>
      {s.maintenance.length ? (
        s.maintenance.map((m) => (
          <div className="incident" key={m.id}>
            <span>{m.name}</span>
            <span>{m.status.replaceAll("_", " ")}</span>
          </div>
        ))
      ) : (
        <p className="caption">No maintenance reported in this observation.</p>
      )}
      <div className="dialog-actions">
        <button
          className="primary"
          onClick={() => download(s, `beacon-${s.id}.json`)}
        >
          <Download size={14} />
          JSON
        </button>
        <button
          className="outline"
          onClick={() =>
            download(snapshotMarkdown(s), `beacon-${s.id}.md`, "text/markdown")
          }
        >
          <Download size={14} />
          Markdown
        </button>
      </div>
      <p className="caption">
        This is the provider's published state, not an independent uptime
        measurement.
      </p>
    </Modal>
  );
}
function RunModal({ run: r, onClose, onSnapshot }) {
  return (
    <Modal title="Recorded workflow" onClose={onClose}>
      <div className="observation-heading">
        <strong>{provider(r.stationId)?.name || r.stationId}</strong>
        <span>{r.status}</span>
      </div>
      <dl className="details">
        <dt>Started</dt>
        <dd>{date(r.startedAt)}</dd>
        <dt>Finished</dt>
        <dd>{date(r.finishedAt)}</dd>
        <dt>Run ID</dt>
        <dd>{r.id}</dd>
      </dl>
      <ol className="steps">
        {r.steps.map((s) => (
          <li key={s.stage}>
            <i>
              {s.status === "done" ? (
                <Check size={14} />
              ) : s.status === "running" ? (
                <Activity size={14} />
              ) : (
                <AlertTriangle size={14} />
              )}
            </i>
            <div>
              <strong>
                {CREW.find((a) => a.id === s.stage)?.name} / {s.stage}
              </strong>
              <p>{s.detail || s.status}</p>
              <time>{date(s.startedAt)}</time>
            </div>
          </li>
        ))}
      </ol>
      {r.error && <p className="inline-error">{r.error}</p>}
      {r.snapshot && (
        <button className="primary full" onClick={() => onSnapshot(r.snapshot)}>
          <FileText size={14} />
          Open observation
        </button>
      )}
    </Modal>
  );
}
function TokenMonitor({ identity, operator, busy, act, onClose, onAuth }) {
  const [wallet, set] = useState(identity.wallet || ""),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title="Token monitor" onClose={onClose}>
      <div className="monitor-heading">
        <Radio size={22} />
        {identity.tokenCA
          ? identity.proof
            ? "Contract verified"
            : "Contract configured"
          : identity.wallet
            ? "Watching for a BEACON launch"
            : "Awaiting a development wallet"}
      </div>
      <dl className="details">
        <dt>Contract address</dt>
        <dd>
          {identity.tokenCA ? (
            <div className="copy-value">
              <code>{identity.tokenCA}</code>
              <CopyButton value={identity.tokenCA} />
            </div>
          ) : (
            "soon"
          )}
        </dd>
        <dt>Watcher</dt>
        <dd>{identity.watchStatus || "unconfigured"}</dd>
        <dt>Last checked</dt>
        <dd>{date(identity.checkedAt)}</dd>
        <dt>Activation slot</dt>
        <dd>{identity.startSlot || "Not configured"}</dd>
      </dl>
      {identity.tokenCA && (
        <External href={`https://solscan.io/token/${identity.tokenCA}`}>
          Token on Solscan
        </External>
      )}
      {identity.proof && (
        <External href={`https://solscan.io/tx/${identity.proof.signature}`}>
          Launch receipt
        </External>
      )}
      {identity.wallet && (
        <div className="wallet-value">
          <code>{identity.wallet}</code>
          <CopyButton value={identity.wallet} />
        </div>
      )}
      {operator ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!addressValid(wallet)) {
              setError("Use a valid public Solana address.");
              return;
            }
            setError("");
            if (!confirm) {
              setConfirm(true);
              return;
            }
            if (await act({ action: "set-wallet", wallet })) onClose();
          }}
        >
          <label>
            Dev wallet
            <input
              required
              maxLength={44}
              value={wallet}
              onChange={(e) => {
                set(e.target.value);
                setConfirm(false);
              }}
            />
          </label>
          {confirm && (
            <p className="caption">
              This starts discovery from the current finalized slot. Only future
              BEACON launches by this wallet qualify. No funds move.
            </p>
          )}
          {error && (
            <p role="alert" className="inline-error">
              {error}
            </p>
          )}
          <button className="primary full" disabled={busy}>
            {busy
              ? "Activating..."
              : confirm
                ? "Activate watcher"
                : "Review wallet"}
          </button>
        </form>
      ) : (
        <>
          <p className="caption">
            A verified Pump creation and initialized mint are required for
            automatic discovery. A dev wallet is not a token address.
          </p>
          <button className="outline full" onClick={onAuth}>
            <Settings2 size={14} />
            Operator settings
          </button>
        </>
      )}
    </Modal>
  );
}
function Guide() {
  return (
    <article className="guide">
      <h2>A watch, not a guess.</h2>
      <p>
        BEACON observes official service-status feeds. Its agents collect a
        response, compare it with the last completed observation and record the
        source-linked result. The station does not execute provider code, send
        transactions or repair services.
      </p>
      <div className="guide-crew">
        {CREW.map((a) => (
          <section key={a.id}>
            <span style={{ color: a.color }}>{a.name}</span>
            <h3>{a.role}</h3>
            <p>
              {a.id === "listen"
                ? "Check the provider identity, schema and response before accepting a reading."
                : a.id === "compare"
                  ? "Separate provider changes, components, incidents and maintenance from collection failures."
                  : "Preserve the observation, collection time, source and input checksum with the actual run."}
            </p>
          </section>
        ))}
      </div>
      <h2>Two things can fail.</h2>
      <p>
        A provider can report a service issue. Or BEACON can fail to fetch the
        provider's feed. Those are different events. An unreachable feed is
        labeled unavailable; its last observation is retained, never silently
        replaced with an all-clear or an outage.
      </p>
      <h2>Time has boundaries.</h2>
      <p>
        Production checks are scheduled every five minutes. Browser refreshes
        read stored observations. A reading more than twelve minutes old is
        stale. The first reading is a baseline, not a recovered incident. An
        incident disappearing from the summary is recorded as removal, not proof
        of resolution.
      </p>
      <h2>What the numbers mean.</h2>
      <p>
        Fetch time measures the status-feed request from BEACON, not the
        performance of the underlying service or a user's region. History bars
        show recorded samples only; blank bars have no data. BEACON does not
        calculate uptime percentages or promise uninterrupted coverage.
      </p>
      <h2>Scope and access.</h2>
      <p>
        The catalog contains four explicitly allowed providers. Arbitrary URLs,
        credentials and redirects are not accepted. Anyone can inspect or
        download observations. Only the operator can connect, pause or remove
        stations. Pausing prevents in-flight publication. Removal stops future
        checks and retains the journal.
      </p>
      <h2>Evidence and retention.</h2>
      <p>
        The station keeps up to 96 samples per provider, 80 runs, 200 workflow
        events and 200 change records. Export evidence for longer retention.
        Checksums fingerprint response bodies; they are not provider signatures
        or security attestations. Agents use deterministic rules, not LLM
        inference.
      </p>
      <h2>The token is separate.</h2>
      <p>
        A dedicated public developer wallet enables the Pump launch watcher.
        Only a matching future BEACON creation with the correct signer and
        initialized mint qualifies. The watcher never moves funds. A configured
        CA does not make a service observation more authoritative.
      </p>
      <div className="reference-links">
        {CATALOG.map((p) => (
          <External key={p.id} href={p.url + "/api"}>
            {p.name} API
          </External>
        ))}
      </div>
      <p className="caption">
        Independent, unaudited software. Provider names identify observed
        sources, not partnerships. No service availability, returns or token
        value is guaranteed.
      </p>
    </article>
  );
}
createRoot(document.getElementById("root")).render(<App />);
