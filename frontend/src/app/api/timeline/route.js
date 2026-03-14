import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MAX_SNAPSHOTS_PER_YEAR = 50;
const SNAPSHOT_BATCH_SIZE = 6;

function normalizeDomain(rawValue) {
  const value = (rawValue || "").trim().toLowerCase();
  if (!value) return "";

  const noProtocol = value.replace(/^https?:\/\//, "");
  return noProtocol.split("/")[0];
}

function sortYears(values) {
  return Array.from(new Set((values || []).map(String))).sort(
    (a, b) => Number(a) - Number(b)
  );
}

async function fetchTimelineYears(domain, signal) {
  const response = await fetch(
    `${BACKEND_BASE_URL}/timeline?domain=${encodeURIComponent(domain)}`,
    {
      method: "GET",
      cache: "no-store",
      signal,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Timeline endpoint failed (${response.status})`);
  }

  const payload = await response.json();
  return sortYears(payload.years);
}

async function fetchSnapshotsForYear(domain, year, signal) {
  const response = await fetch(
    `${BACKEND_BASE_URL}/snapshots?domain=${encodeURIComponent(domain)}&year=${encodeURIComponent(year)}`,
    {
      method: "GET",
      cache: "no-store",
      signal,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  const list = Array.isArray(payload.snapshots) ? payload.snapshots : [];

  return list.slice(0, MAX_SNAPSHOTS_PER_YEAR).map((item) => ({
    timestamp: item.timestamp,
    date: item.date,
    url: item.url,
  }));
}

async function collectSnapshotsByYear(domain, years, signal) {
  const snapshots = {};

  for (let offset = 0; offset < years.length; offset += SNAPSHOT_BATCH_SIZE) {
    const batch = years.slice(offset, offset + SNAPSHOT_BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (year) => {
        const list = await fetchSnapshotsForYear(domain, year, signal);
        return { year, list };
      })
    );

    for (const result of batchResults) {
      snapshots[result.year] = result.list;
    }
  }

  return snapshots;
}

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const domain = normalizeDomain(searchParams.get("domain"));

  if (!domain) {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }

  try {
    const years = await fetchTimelineYears(domain, request.signal);

    if (years.length === 0) {
      return NextResponse.json({
        domain,
        years: [],
        snapshots: {},
      });
    }

    const snapshots = await collectSnapshotsByYear(domain, years, request.signal);

    return NextResponse.json({
      domain,
      years,
      snapshots,
    });
  } catch {
    return NextResponse.json(
      {
        domain,
        years: [],
        snapshots: {},
      },
      { status: 502 }
    );
  }
}
