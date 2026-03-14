import json
import logging
from typing import List, Tuple
import httpx
from utils.rate_limit import rate_limited_request

wayback_cdx = "https://web.archive.org/cdx/search/cdx"
max_pagination_loops = 5
_client = httpx.AsyncClient(timeout=60)

def clean_domain(domain: str) -> str:
    domain = domain.strip().lower()
    for prefix in ("https://", "http://"):
        if domain.startswith(prefix):
            domain = domain[len(prefix):]
    if domain.startswith("www."):
        domain = domain[4:]
    return domain.rstrip("/")

def _parse_cdx_json(text: str) -> Tuple[list, str | None]:
    rows = []
    resume_key = None
    json_end = text.rfind("]")
    if json_end == -1:
        return rows, resume_key
    json_str = text[: json_end + 1]
    remainder = text[json_end+1:].strip()
    try:
        rows = json.loads(json_str)
    except Exception:
        return [], None
    if remainder:
        resume_key = remainder
    return rows, resume_key

async def _paginated_fetch(params: dict) -> list:
    all_rows = []
    current_params = {**params, "showResumeKey": "true", "limit": "50000"}
    for _ in range(max_pagination_loops):
        try:
            response = await rate_limited_request(_client, wayback_cdx, params=current_params)
            response.raise_for_status()
            rows, resume_key = _parse_cdx_json(response.text)
        except Exception as e:
            logging.error("CDX fetch error: %s", e)
            break
        start = 0
        if rows and isinstance(rows[0], list) and "timestamp" in rows[0]:
            start = 1
        all_rows.extend(rows[start:])
        if not resume_key:
            break
        current_params["resumeKey"] = resume_key
    return all_rows

async def fetch_timeline(domain: str) -> List[str]:
    cleaned = clean_domain(domain)
    targets = [f"{cleaned}/", f"www.{cleaned}/"]
    years: set[str] = set()
    for target in targets:
        params = {
            "url": target,
            "output": "json",
            "fl": "timestamp",
            "collapse": "timestamp:4",
            "matchType": "domain",
            "limit": "300",
        }
        try:
            response = await rate_limited_request(_client, wayback_cdx, params=params)
            response.raise_for_status()
            rows = json.loads(response.text)
        except Exception as e:
            logging.warning("Timeline fetch failed for %s: %s", target, e)
            continue
        start = 0
        if rows and isinstance(rows[0], list) and "timestamp" in rows[0]:
            start = 1

        for row in rows[start:]:
            if isinstance(row, list) and row:
                ts = row[0]
                if isinstance(ts, str) and len(ts) >= 4:
                    years.add(ts[:4])
        if years:
            break
    return sorted(years)

async def fetch_snapshots(domain: str, year: str) -> list:
    cleaned = clean_domain(domain)
    targets = [f"{cleaned}/", f"www.{cleaned}/"]
    snapshots = []
    for target in targets:
        params = {
            "url": target,
            "from": year,
            "to": year,
            "output": "json",
            "fl": "timestamp,original",
            "collapse": "timestamp:8",
        }
        rows = await _paginated_fetch(params)
        if rows:
            for row in rows:
                if not isinstance(row, list) or len(row) < 2:
                    continue
                ts, original = row[0], row[1]
                if not isinstance(ts, str) or len(ts) < 8:
                    continue
                snapshots.append({
                    "timestamp": ts,
                    "date": f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}",
                    "url": f"https://web.archive.org/web/{ts}/{original}",
                })
            if snapshots:
                break
                
    return snapshots