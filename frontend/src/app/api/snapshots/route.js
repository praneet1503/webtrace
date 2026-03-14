import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function normalizeDomain(rawValue) {
  const value = (rawValue || "").trim().toLowerCase();
  if (!value) return "";

  const noProtocol = value.replace(/^https?:\/\//, "");
  return noProtocol.split("/")[0];
}

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const domain = normalizeDomain(searchParams.get("domain"));
  const year = String(searchParams.get("year") || "").trim();

  if (!domain || !year) {
    return NextResponse.json(
      { error: "domain and year are required", domain, year, snapshots: [] },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `${BACKEND_BASE_URL}/snapshots?domain=${encodeURIComponent(domain)}&year=${encodeURIComponent(year)}`,
      {
        method: "GET",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { domain, year, snapshots: [] },
        { status: 502 }
      );
    }

    const payload = await response.json();
    const snapshots = Array.isArray(payload.snapshots) ? payload.snapshots : [];

    return NextResponse.json({
      domain: payload.domain || domain,
      year: String(payload.year || year),
      snapshots,
      cached: Boolean(payload.cached),
    });
  } catch {
    return NextResponse.json(
      { domain, year, snapshots: [] },
      { status: 502 }
    );
  }
}
