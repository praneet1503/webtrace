import logging
from fastapi import FastAPI,Query
from fastapi.middleware.cors import CORSMiddleware
from cachetools import TTLCache
import httpx
from fastapi.responses import JSONResponse
logging.basicConfig(level=logging.INFO)

app = FastAPI()

# Allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# cache results for 1 hour
cache = TTLCache(maxsize=300, ttl=3600)

WAYBACK_API = "https://web.archive.org/cdx/search/cdx"


async def fetch_wayback(domain: str):

    domain = domain.replace("https://", "").replace("http://", "").replace("www.", "")
    query_domains = [f"*.{domain}", domain]  # try wildcard first, then plain domain
    years = set()

    async with httpx.AsyncClient(timeout=30) as client:

        for query_domain in query_domains:
            resume_key = None

            while True:
                params = {
                    "url": query_domain,
                    "output": "json",
                    "fl": "timestamp",
                    "filter": "statuscode:200",
                    "limit": 5000,
                    "showResumeKey": "true"
                }

                if resume_key:
                    params["resumeKey"] = resume_key

                try:
                    r = await client.get(WAYBACK_API, params=params)
                    r.raise_for_status()
                    data = r.json()
                except Exception as e:
                    logging.warning("Wayback fetch failed for %s : %s", domain, e)
                    break

                if not data or len(data) <= 1:
                    break

                for row in data[1:]:
                    if not isinstance(row, list) or len(row) == 0:
                        continue

                    timestamp = row[0]

                    if not timestamp.isdigit() or len(timestamp) < 4:
                        continue

                    years.add(timestamp[:4])

                # get resume key if present (safe check)
                last_item = data[-1]
                if isinstance(last_item, str) and len(last_item) > 0 and not last_item.isdigit():
                    resume_key = last_item
                else:
                    break

                if len(years) > 50:
                    break

            if years:
                break  # stop if we already got results

    return sorted(years)


#the main links of the backend 
@app.get("/timeline")
async def get_timeline(domain: str):

    logging.info("GET /timeline?domain=%s", domain)

    if domain in cache:
        logging.info("cache hit for %s", domain)
        return {
            "domain": domain,
            "years": cache[domain],
            "cached": True
        }

    years = await fetch_wayback(domain)

    if years is None:
        years = []

    cache[domain] = years
    logging.info("returning %d years for %s", len(years), domain)
    return {"domain": domain,"years": years,"cached": False}

@app.get("/health")
def health_check():
    return JSONResponse(content={"status":"online"},status_code=200)

@app.get("/snapshots")
async def get_snapshots(domain:str,year:str):
    url="https://web.archive.org/cdx/search/cdx"

    params = {
        "url":domain,
        "from":year,
        "to":year,
        "output":"json",
        "fl":"timestamp",
        "filter":"statuscode:200",
        "collapse": "timestamp:8",
        "limit":50
    }
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url,params=params)
            response.raise_for_status()
            data = response.json()

            if not data or len(data) <=1:
                return {"snapshots":[]}
            
            snapshots=[]
            for row in data[1:]:
                timestamp = row[0]
                formatted_date=f"{timestamp[:4]}-{timestamp[4:6]}-{timestamp[6:8]}"
                snapshots.append({
                    "timestamp":timestamp,
                    "date":formatted_date
                })
            return {"snapshots": snapshots}
        except Exception as e:
            print(f"Error fetching snapshots: {e}")
            return{"snapshots":[],"error":str(e)}