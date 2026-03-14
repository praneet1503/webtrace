"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function normalizeDomain(rawValue) {
  const value = (rawValue || "").trim().toLowerCase();
  if (!value) return "";

  const noProtocol = value.replace(/^https?:\/\//, "");
  return noProtocol.split("/")[0];
}

function snapshotToPreviewUrl(domainValue, snapshot) {
  if (!snapshot) return "";
  if (snapshot.url) return snapshot.url;
  if (!snapshot.timestamp) return "";
  return `https://web.archive.org/web/${snapshot.timestamp}/${domainValue}/`;
}

export default function Home() {
  const [domain, setDomain] = useState("");
  const [activeDomain, setActiveDomain] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [firstSnapshotsByYear, setFirstSnapshotsByYear] = useState({});
  const [preloadingFirstSnapshots, setPreloadingFirstSnapshots] = useState(false);
  const [playbackTimelineReady, setPlaybackTimelineReady] = useState(false);
  const [isPlayingHistory, setIsPlayingHistory] = useState(false);

  const playbackYearsRef = useRef([]);
  const playbackDomainRef = useRef("");
  const playbackIndexRef = useRef(-1);
  const playbackSessionRef = useRef(0);
  const preloadTokenRef = useRef(0);
  const firstSnapshotsRef = useRef({});

  const yearsLabel = useMemo(() => {
    if (!years.length) return "No timeline data loaded yet.";
    const first = years[0];
    const last = years[years.length - 1];
    return `${years.length} years loaded (${first} to ${last})`;
  }, [years]);

  const selectedYearIndex = useMemo(() => {
    if (!years.length) return 0;
    const index = years.indexOf(String(selectedYear));
    return index >= 0 ? index : years.length - 1;
  }, [selectedYear, years]);

  const playHistoryDisabled =
    isLoading || !years.length || !activeDomain || !playbackTimelineReady;

  function stopPlayback() {
    playbackSessionRef.current += 1;
    playbackYearsRef.current = [];
    playbackDomainRef.current = "";
    playbackIndexRef.current = -1;
    setIsPlayingHistory(false);
  }

  async function fetchSnapshotsForYear(domainValue, yearValue) {
    const response = await fetch(
      `${API_BASE}/snapshots?domain=${encodeURIComponent(domainValue)}&year=${encodeURIComponent(String(yearValue))}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("No snapshots in this year.");
    }

    const payload = await response.json();
    return Array.isArray(payload.snapshots) ? payload.snapshots : [];
  }

  async function loadSnapshots(domainValue, yearValue, options = {}) {
    const { updatePreviewFromFirst = false } = options;

    setSelectedYear(String(yearValue));
    setSnapshotsLoading(true);
    setSnapshotError("");

    try {
      const nextSnapshots = await fetchSnapshotsForYear(domainValue, yearValue);
      setSnapshots(nextSnapshots);

      const firstSnapshot = nextSnapshots[0] || null;
      if (firstSnapshot) {
        setFirstSnapshotsByYear((prev) => ({ ...prev, [String(yearValue)]: firstSnapshot }));
        if (updatePreviewFromFirst) {
          setPreviewUrl(snapshotToPreviewUrl(domainValue, firstSnapshot));
        }
      }

      if (!nextSnapshots.length) {
        setSnapshotError("No snapshots in this year.");
      }
    } catch {
      setSnapshots([]);
      setSnapshotError("No snapshots in this year.");
    } finally {
      setSnapshotsLoading(false);
    }
  }

  async function preloadFirstSnapshots(domainValue, yearList) {
    const preloadToken = ++preloadTokenRef.current;
    setPreloadingFirstSnapshots(true);
    setPlaybackTimelineReady(false);

    const queue = [...yearList];
    const workerCount = Math.min(5, queue.length);

    const workers = Array.from({ length: workerCount }, async () => {
      while (queue.length > 0) {
        const year = queue.shift();
        if (!year) return;

        try {
          const list = await fetchSnapshotsForYear(domainValue, year);
          const firstSnapshot = list[0] || null;

          if (preloadToken !== preloadTokenRef.current) {
            return;
          }

          if (firstSnapshot) {
            setFirstSnapshotsByYear((prev) => {
              if (prev[String(year)]) return prev;
              return { ...prev, [String(year)]: firstSnapshot };
            });
          }
        } catch {
          // Ignore individual year preload failures.
        }
      }
    });

    await Promise.all(workers);

    if (preloadToken === preloadTokenRef.current) {
      setPreloadingFirstSnapshots(false);
      setPlaybackTimelineReady(true);
    }
  }

  async function ensureFirstSnapshot(domainValue, yearValue) {
    const yearKey = String(yearValue);
    const cached = firstSnapshotsRef.current[yearKey];
    if (cached) return cached;

    try {
      const list = await fetchSnapshotsForYear(domainValue, yearKey);
      const firstSnapshot = list[0] || null;

      if (firstSnapshot) {
        setFirstSnapshotsByYear((prev) => ({ ...prev, [yearKey]: firstSnapshot }));
      }

      return firstSnapshot;
    } catch {
      return null;
    }
  }

  async function handleSelectYear(yearValue) {
    if (!activeDomain) return;
    stopPlayback();

    const yearKey = String(yearValue);
    const cachedFirst = firstSnapshotsRef.current[yearKey];
    setSelectedYear(yearKey);

    if (cachedFirst) {
      setPreviewUrl(snapshotToPreviewUrl(activeDomain, cachedFirst));
      await loadSnapshots(activeDomain, yearKey, { updatePreviewFromFirst: false });
      return;
    }

    await loadSnapshots(activeDomain, yearKey, { updatePreviewFromFirst: true });
  }

  function handleSliderChange(event) {
    if (!years.length) return;
    const index = Number(event.target.value);
    const clampedIndex = Math.max(0, Math.min(index, years.length - 1));
    const yearValue = years[clampedIndex];
    handleSelectYear(yearValue);
  }

  function handlePlaybackToggle() {
    if (!years.length || !activeDomain || !playbackTimelineReady) return;

    if (isPlayingHistory) {
      stopPlayback();
      return;
    }

    const yearList = [...years];
    const domainValue = activeDomain;
    const startIndex = selectedYearIndex >= 0 ? selectedYearIndex : 0;
    const sessionId = playbackSessionRef.current + 1;

    playbackSessionRef.current = sessionId;
    playbackYearsRef.current = yearList;
    playbackDomainRef.current = domainValue;
    playbackIndexRef.current = startIndex;
    setIsPlayingHistory(true);

    const startYear = yearList[startIndex];
    if (!startYear) {
      stopPlayback();
      return;
    }

    ensureFirstSnapshot(domainValue, startYear).then((firstSnapshot) => {
      if (sessionId !== playbackSessionRef.current) return;
      if (!firstSnapshot) {
        stopPlayback();
        return;
      }

      setSelectedYear(String(startYear));
      setPreviewUrl(snapshotToPreviewUrl(domainValue, firstSnapshot));
    });
  }

  function handlePreviewLoad() {
    if (!isPlayingHistory) return;

    const sessionId = playbackSessionRef.current;
    const yearList = playbackYearsRef.current;
    const domainValue = playbackDomainRef.current;
    const nextIndex = playbackIndexRef.current + 1;

    if (!yearList.length || !domainValue || nextIndex >= yearList.length) {
      stopPlayback();
      return;
    }

    const nextYear = yearList[nextIndex];
    playbackIndexRef.current = nextIndex;

    ensureFirstSnapshot(domainValue, nextYear).then((firstSnapshot) => {
      if (sessionId !== playbackSessionRef.current) return;

      if (!firstSnapshot) {
        stopPlayback();
        return;
      }

      setSelectedYear(String(nextYear));
      setPreviewUrl(snapshotToPreviewUrl(domainValue, firstSnapshot));
    });
  }

  async function handleTrace(event) {
    event.preventDefault();
    stopPlayback();

    const normalized = normalizeDomain(domain);
    if (!normalized) {
      setError("Enter a valid domain.");
      setYears([]);
      setActiveDomain("");
      setSelectedYear("");
      setSnapshots([]);
      setSnapshotError("");
      setPreviewUrl("");
      setFirstSnapshotsByYear({});
      setPreloadingFirstSnapshots(false);
      setPlaybackTimelineReady(false);
      return;
    }

    setIsLoading(true);
    setError("");
    setSnapshotError("");
    setPreviewUrl("");
    setFirstSnapshotsByYear({});
    setPreloadingFirstSnapshots(false);
    setPlaybackTimelineReady(false);

    try {
      const response = await fetch(
        `${API_BASE}/timeline?domain=${encodeURIComponent(normalized)}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("No archive data found.");
      }

      const payload = await response.json();
      const nextYears = Array.isArray(payload.years)
        ? payload.years.map(String).sort((a, b) => Number(a) - Number(b))
        : [];

      setActiveDomain(normalized);
      setYears(nextYears);
      setSnapshots([]);

      if (!nextYears.length) {
        setError("No archive data found.");
        setSelectedYear("");
      } else {
        const defaultYear = nextYears[nextYears.length - 1];
        await loadSnapshots(normalized, defaultYear, { updatePreviewFromFirst: true });
        preloadFirstSnapshots(normalized, nextYears);
      }
    } catch {
      setActiveDomain(normalized);
      setYears([]);
      setSelectedYear("");
      setSnapshots([]);
      setSnapshotError("");
      setPreviewUrl("");
      setFirstSnapshotsByYear({});
      setPreloadingFirstSnapshots(false);
      setPlaybackTimelineReady(false);
      setError("No archive data found.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    firstSnapshotsRef.current = firstSnapshotsByYear;
  }, [firstSnapshotsByYear]);

  useEffect(() => {
    return () => {
      stopPlayback();
      preloadTokenRef.current += 1;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#111111] text-[#e8e7e3] font-mono">
      <div className="mx-auto w-full max-w-270 px-6 py-6">
        <header className="flex items-center justify-between border-b border-[#2f2f2f] pb-4">
          <p className="text-[29px] tracking-tight text-[#ecebe8]">WebTrace</p>
          <p className="text-9px">yeah it's a <a href="https://web.archive.org/" target="_blank" rel="noopener noreferrer" className="text-[#53524d] hover:underline">
            wayback machine
          </a> ripoff</p>
          <nav className="flex items-center gap-5 text-[14px] text-[#8f8e89]">
            <Link href="/about" className="hover:text-[#dddcd8]">
              about
            </Link>
            <a
              href="https://github.com/praneet1503/website-timeline"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#dddcd8]"
            >
              github
            </a>
          </nav>
        </header>

        <main className="pt-5">
          <section className="border border-[#2f2f2f] bg-[#131313] px-6 py-8">
            <h1 className="text-center text-[41px] font-semibold leading-tight text-[#e4e3df]">
              Explore the history of any website
            </h1>

            <form
              onSubmit={handleTrace}
              className="mx-auto mt-6 grid w-full max-w-[740px] grid-cols-[1fr_auto] gap-3"
            >
              <input
                type="text"
                placeholder="youtube.com"
                value={domain}
                onChange={(event) => setDomain(event.target.value)}
                className="h-11 border border-[#3c3c3c] bg-[#161616] px-4 text-[15px] text-[#d8d7d2] placeholder:text-[#66655f] outline-none focus:border-[#575650]"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="h-11 border border-[#4c4c4c] bg-[#1a1a1a] px-7 text-[14px] font-semibold tracking-[0.08em] text-[#e6e5df] hover:bg-[#222222] disabled:cursor-wait disabled:opacity-70"
              >
                {isLoading ? "TRACING..." : "TRACE"}
              </button>
            </form>

            <p className="mt-4 text-center text-[13px] text-[#787772]">
              try: openai.com • wikipedia.org • youtube.com
            </p>

            <p className="mt-2 text-center text-[13px] text-[#8b8a84]">{error || yearsLabel}</p>
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-[1.45fr_1fr]">
            <div className="min-h-[500px] border border-[#2f2f2f] bg-[#131313] p-3">
              <div className="h-full w-full border border-[#242424] bg-[#121212] p-4">
                <p className="text-[12px] uppercase tracking-[0.12em] text-[#8b8a84]">
                  Timeline {activeDomain ? `for ${activeDomain}` : ""}
                </p>

                {years.length > 0 ? (
                  <>
                    <div className="mt-4 grid grid-cols-4 gap-2 text-[12px] text-[#d1d0cc]">
                      {years.map((year) => {
                        const isActive = String(selectedYear) === String(year);
                        return (
                          <button
                            key={year}
                            type="button"
                            onClick={() => handleSelectYear(year)}
                            className={`border px-2 py-1 text-center ${
                              isActive
                                ? "border-[#6a6964] bg-[#212121]"
                                : "border-[#2e2e2e] hover:border-[#4f4f4a]"
                            }`}
                          >
                            {year}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 border-t border-[#2a2a2a] pt-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] uppercase tracking-[0.1em] text-[#8b8a84]">
                          Year slider {selectedYear ? `(${selectedYear})` : ""}
                        </p>
                        <button
                          type="button"
                          onClick={handlePlaybackToggle}
                          disabled={playHistoryDisabled}
                          className={`border px-3 py-1 text-[11px] uppercase tracking-[0.08em] text-[#d4d3ce] ${
                            playHistoryDisabled
                              ? "cursor-wait border-[#353530] opacity-70"
                              : "border-[#3f3f3a] hover:border-[#66655f]"
                          }`}
                        >
                          {isPlayingHistory ? "Stop" : "Play history"}
                        </button>
                      </div>

                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, years.length - 1)}
                        value={selectedYearIndex}
                        onChange={handleSliderChange}
                        className="mt-3 w-full"
                      />

                      {preloadingFirstSnapshots && (
                        <p className="mt-2 text-[12px] text-[#8b8a84]">
                          Aggressively preloading first snapshots for smooth playback...
                        </p>
                      )}

                      {!preloadingFirstSnapshots && playbackTimelineReady && (
                        <p className="mt-2 text-[12px] text-[#8b8a84]">
                          the playback timeline has loaded you can now use the play history button
                        </p>
                      )}
                    </div>

                    <div className="mt-4 border-t border-[#2a2a2a] pt-3">
                      <p className="text-[11px] uppercase tracking-[0.1em] text-[#8b8a84]">
                        Snapshots {selectedYear ? `(${selectedYear})` : ""}
                      </p>

                      {snapshotsLoading && (
                        <p className="mt-3 text-[13px] text-[#7a7972]">Fetching snapshots...</p>
                      )}

                      {!snapshotsLoading && snapshotError && (
                        <p className="mt-3 text-[13px] text-[#9a827a]">{snapshotError}</p>
                      )}

                      {!snapshotsLoading && !snapshotError && snapshots.length > 0 && (
                        <div className="mt-3 max-h-[290px] space-y-2 overflow-auto pr-1">
                          {snapshots.map((snapshot) => {
                            const ts = snapshot.timestamp || "";
                            const datePart = snapshot.date || ts.slice(0, 8);
                            const timePart = ts.length >= 12 ? `${ts.slice(8, 10)}:${ts.slice(10, 12)}` : "--:--";
                            return (
                              <button
                                key={ts}
                                type="button"
                                onClick={() => {
                                  stopPlayback();
                                  setPreviewUrl(snapshotToPreviewUrl(activeDomain, snapshot));
                                }}
                                className="w-full border border-[#2e2e2e] px-3 py-2 text-left text-[12px] hover:border-[#53524d]"
                              >
                                <div className="flex items-center justify-between text-[#d2d1cc]">
                                  <span>{datePart}</span>
                                  <span>{timePart}</span>
                                </div>
                                <p className="mt-1 text-[11px] text-[#7d7c76]">snapshot available</p>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="mt-4 text-[13px] text-[#6f6e68]">
                    Search a domain to load timeline years without leaving this page.
                  </p>
                )}
              </div>
            </div>

            <aside className="min-h-[500px] border border-[#2f2f2f] bg-[#131313] p-3">
              <div className="flex h-full flex-col gap-3">
                <div className="flex-1">
                  {previewUrl ? (
                    <div className="h-full w-full border border-[#242424] bg-[#101010]">
                      <iframe
                        title="Wayback Preview"
                        src={previewUrl}
                        onLoad={handlePreviewLoad}
                        className="h-full min-h-[470px] w-full bg-white"
                      />
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center border border-[#242424] bg-[#101010] px-6 text-center text-[14px] text-[#77766f]">
                      Select a snapshot to open archived page preview.
                    </div>
                  )}
                </div>

                {previewUrl && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block border border-[#3f3f3a] bg-[#161616] px-3 py-2 text-center text-[12px] uppercase tracking-[0.08em] text-[#d4d3ce] hover:border-[#66655f]"
                  >
                    open in wayback machine
                  </a>
                )}
              </div>
            </aside>
          </section>
        </main>
      </div>
      <footer className="mt-12 border-t border-[#2f2f2f] pt-2 text-center text-[13px] text-[#787772] px-20">
        <p>API's from wayback machine</p>
        <p> a project by <a href="https://github.com/praneet1503" target="_blank" rel="noopener noreferrer" className="text-[#53524d] hover:underline">praneet</a></p>
      </footer>
    </div>
  );
}
