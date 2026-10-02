import asyncio
import logging
import random

import httpx

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("client")

BASE = "http://127.0.0.1:8765/item/"
MAX_ATTEMPTS = 4
CONCURRENCY = 4           # stay under the server's limit of 5 in flight
RETRYABLE = {429, 500, 502, 503, 504}


async def fetch(client: httpx.AsyncClient, gate: asyncio.Semaphore, item: int) -> dict:
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            async with gate:                       # limits how many requests are in flight
                resp = await client.get(BASE + str(item))
            if resp.status_code == 200:
                if attempt > 1:
                    log.info("item %s ok on attempt %s", item, attempt)
                return resp.json()
            if resp.status_code not in RETRYABLE:
                resp.raise_for_status()            # a 4xx other than 429 will not get better
            wait = float(resp.headers.get("Retry-After", 0.2 * 2 ** attempt + random.random() * 0.1))
            log.info("item %s got %s, retry %s in %.2fs", item, resp.status_code, attempt, wait)
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            wait = 0.2 * 2 ** attempt + random.random() * 0.1
            log.info("item %s %s, retry %s in %.2fs", item, type(exc).__name__, attempt, wait)
        await asyncio.sleep(wait)
    raise RuntimeError(f"item {item} failed after {MAX_ATTEMPTS} attempts")


async def main() -> None:
    gate = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:      # one client, reused
        async with asyncio.timeout(30):                                      # overall deadline (Python 3.11+)
            results = await asyncio.gather(*(fetch(client, gate, i) for i in range(1, 21)))
    log.info("done: %s results, %s needed a retry", len(results), sum(r["attempt"] > 1 for r in results))


asyncio.run(main())
