import csv
import logging
from pathlib import Path
from typing import List

from cachetools import TTLCache

CACHE_DIR = Path(__file__).parent / "cache"
TIMELINE_FILE = CACHE_DIR / "timeline_cache.csv"
SNAPSHOT_FILE = CACHE_DIR / "snapshot_cache.csv"

timeline_mem = TTLCache(maxsize=500, ttl=3600)
snapshot_mem = TTLCache(maxsize=500, ttl=3600)


def ensure_cache_files():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    if not TIMELINE_FILE.exists() or TIMELINE_FILE.stat().st_size == 0:
        with open(TIMELINE_FILE, "w", newline="") as f:
            csv.writer(f).writerow(["domain", "years"])

    if not SNAPSHOT_FILE.exists() or SNAPSHOT_FILE.stat().st_size ==0:
        with open(SNAPSHOT_FILE,"w",newline="") as f:
            csv.writer(f).writerow(["domain","year","timestamp"])

def get_timeline_from_memory(domain: str) -> List[str] | None:
    return timeline_mem.get(domain)


def get_timeline_from_disk(domain: str) -> List[str] | None:
    if not TIMELINE_FILE.exists():
        return None
    try:
        from wayback import clean_domain
        search_target = clean_domain(domain) 

        with open(TIMELINE_FILE, "r") as f:
            for row in csv.DictReader(f):
                cached_domain = clean_domain(row.get("domain", ""))
                if cached_domain == search_target:
                    years_str = row.get("years", "")
                    years = [y.strip() for y in years_str.split("|") if y.strip()] if years_str else []
                    if years:
                        return years
                    return None
    except Exception as exc:
        logging.warning("Failed to read timeline disk cache for %s: %s", domain, exc)
    return None

def save_timeline(domain: str, years: List[str]):
    years_string = "|".join(str(y).strip() for y in years)
    timeline_mem[domain] = years
    if not TIMELINE_FILE.exists():
        return
    try:
        rows = []
        with open(TIMELINE_FILE, "r") as f:
            for row in csv.DictReader(f):
                if row.get("domain") != domain:
                    rows.append(row)
        rows.append({"domain": domain, "years": years_string})
        with open(TIMELINE_FILE, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["domain", "years"])
            writer.writeheader()
            writer.writerows(rows)
    except Exception as exc:
        logging.warning("Failed to save timeline cache for %s: %s", domain, exc)

def _snapshot_key(domain: str, year: str) -> str:
    return f"{domain}_{year}"

def get_snapshots_from_memory(domain: str, year: str) -> list | None:
    return snapshot_mem.get(_snapshot_key(domain, year))

def get_snapshots_from_disk(domain: str, year: str) -> list | None:
    if not SNAPSHOT_FILE.exists():
        return None
    snapshots = []
    try:
        from wayback import clean_domain
        search_target = clean_domain(domain)
        with open(SNAPSHOT_FILE, "r") as f:
            for row in csv.DictReader(f):
                cached_domain = clean_domain(row.get("domain", ""))
                cached_year = str(row.get("year", "")).strip()
                if cached_domain == search_target and cached_year == str(year):
                    ts = row.get("timestamp", "").strip()
                    if len(ts) >= 8:
                        snapshots.append({
                            "timestamp": ts,
                            "date": f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}",
                            "url": f"https://web.archive.org/web/{ts}/{search_target}/",
                        })
    except Exception as exc:
        logging.warning("Failed to read snapshot disk cache for %s/%s: %s", domain, year, exc)
        return None
    return snapshots if snapshots else None

def save_snapshots(domain: str, year: str, snapshots: list):
    snapshot_mem[_snapshot_key(domain, year)] = snapshots
    if not SNAPSHOT_FILE.exists():
        return
    try:
        rows = []
        with open(SNAPSHOT_FILE, "r") as f:
            for row in csv.DictReader(f):
                if not (row.get("domain") == domain and row.get("year") == year):
                    rows.append(row)
        for snap in snapshots:
            rows.append({"domain": domain, "year": year, "timestamp": snap.get("timestamp", "")})
        with open(SNAPSHOT_FILE, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["domain", "year", "timestamp"])
            writer.writeheader()
            writer.writerows(rows)
    except Exception as exc:
        logging.warning("Failed to save snapshot cache for %s/%s: %s", domain, year, exc)