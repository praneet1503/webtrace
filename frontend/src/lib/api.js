const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function toErrorMessage(prefix, status) {
  return `${prefix} (${status})`;
}

export function normalizeDomainInput(rawValue) {
  const value = (rawValue || "").trim().toLowerCase();
  if (!value) return "";

  const withoutProtocol = value.replace(/^https?:\/\//, "");
  return withoutProtocol.split("/")[0];
}

export function sortTimelineYears(years) {
  return Array.from(new Set((years || []).map(String))).sort(
    (a, b) => Number(a) - Number(b)
  );
}

export function buildWaybackUrl(domain, timestamp) {
  if (!domain || !timestamp) return null;
  return `https://web.archive.org/web/${timestamp}/${domain}`;
}

export async function fetchTimeline(domain, signal) {
  if (!domain) {
    throw new Error("Domain is required");
  }

  const url = `${API_BASE}/timeline?domain=${encodeURIComponent(domain)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(toErrorMessage("Failed to fetch timeline", response.status));
  }

  const payload = await response.json();
  return {
    domain: payload.domain || domain,
    years: sortTimelineYears(payload.years),
    cached: Boolean(payload.cached),
  };
}

export async function fetchSnapshots(domain, year, signal) {
  if (!domain) {
    throw new Error("Domain is required");
  }
  if (!year) {
    throw new Error("Year is required");
  }

  const url = `${API_BASE}/snapshots?domain=${encodeURIComponent(domain)}&year=${encodeURIComponent(String(year))}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(toErrorMessage("Failed to fetch snapshots", response.status));
  }

  const payload = await response.json();
  const snapshots = Array.isArray(payload.snapshots) ? payload.snapshots : [];

  return {
    domain: payload.domain || domain,
    year: String(payload.year || year),
    snapshots,
    cached: Boolean(payload.cached),
  };
}