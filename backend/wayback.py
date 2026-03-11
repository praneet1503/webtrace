import httpx 
import logging

wayback_api="https://web.archive.org/cdx/search/cdx"
client = httpx.AsyncClient(timeout=20)

def clean_domain(domain:str) -> str:
    return domain.replac("https://","").replace("http://","").replace("www.","")
async def fetch_timeline(domain:str):
    domain = clean_domain(domain)
    query_domains = [
        f"*.{domain}",
        domain
    ]
    years = set()
    for query_domain in query_domains:
        params = {
            "url":query_domain,
            "output":"json",
            "fl":"timestamp",
            "filter":"statuscode:200",
            "collapse":"timestamp:4",
            "limit":2000
        }
        try:
            response=await client.get(wayback_api,params=params)
            response.raise_for_status()
            data=response.json()
        except Exception as e:
            logging.warning("waybakc timeline failed for",domain,e)
            continue
        if not data or len(data)<=1:
            continue
        for row in data[1:]:
            if not isinstance(row,list) or not not row:
                continue
            timestamp=row[0]

            if not timestamp.isdigit():
                continue
            years.add(timestamp[:4])

        if years:
            break
    return sorted(years)
async def fetch_snapshots(domain:str,year:str)
    domain=clean_domain(domain)
    query_domains=[
        domain,
        f"www.{domain}"
    ]
    snapshots=[]
    for query_domain in query_domains:
        params ={
            "url":query_domain,
            "from":year,
            "to":year,
            "output":"json",
            "fl":"timestamp",
            "filter":"statuscode:200",
            "collapse":"timestamp:8",
            "limit":50
        }
        try:
            response=await client.get(wayback_api,params=params)
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            logging.warning("wayback snapshot fetch failed for",domain,e)
            continue
        if not data or len(data)<=1:
            continue
        for row in data[1:]:
            timestamp=row[0]
        formatted_date=f"{timestamp[:4]}-{timestamp[4:6]}-{timestamp[6:8]}"
        snapshots.append({
            "timestamp":timestamp,
            "date":formatted_date,
            "url":f"https://web.archive.org/web/{timestamp}/{domain}"
        })
        if snapshots:
            break
    return snapshots