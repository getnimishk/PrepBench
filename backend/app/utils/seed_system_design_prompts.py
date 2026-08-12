"""
Seeds the built-in system design prompt bank on first run. A small, fixed,
curated list -- unlike the large optional PSM question-bank import, this is
safe to seed unconditionally-if-empty at every startup.
"""
from sqlalchemy.orm import Session
from app.repositories.system_design_repository import SystemDesignPromptRepository
from app.schemas.system_design import SystemDesignPromptCreate
from app.models.question import QuestionDifficulty

SEED_SYSTEM_DESIGN_PROMPTS = [
    {
        "title": "Design a URL Shortener",
        "prompt_text": "Design a service like bit.ly that converts long URLs into short aliases and redirects users to the original URL. It must handle millions of new URLs per day and billions of redirects, with low-latency reads. Consider how short codes are generated, how you'd handle custom aliases, and how you'd scale reads far beyond writes.",
        "category": "Distributed Systems",
        "difficulty": "easy",
    },
    {
        "title": "Design a Rate Limiter",
        "prompt_text": "Design a rate limiting service that can be used by multiple downstream APIs to limit how many requests a client can make in a given time window. It needs to work correctly across multiple servers/instances, not just a single machine, and should support different limits per client tier.",
        "category": "Distributed Systems",
        "difficulty": "medium",
    },
    {
        "title": "Design a Chat Application",
        "prompt_text": "Design a real-time one-on-one and group messaging system like WhatsApp. Users should see messages arrive instantly when online, and receive them on reconnect when offline. Consider message ordering, delivery/read receipts, and how you'd scale to millions of concurrent connections.",
        "category": "Real-Time Systems",
        "difficulty": "hard",
    },
    {
        "title": "Design a News Feed",
        "prompt_text": "Design the news feed system for a social network like Twitter or Instagram, where users see a reverse-chronological or ranked feed of posts from people they follow. Consider fan-out on write vs. fan-out on read, and how you'd handle users who follow millions of accounts or are followed by millions.",
        "category": "Social/Feed Systems",
        "difficulty": "hard",
    },
    {
        "title": "Design a Video Streaming Service",
        "prompt_text": "Design the core architecture for a video streaming platform like YouTube: video upload, transcoding into multiple resolutions, storage, and low-latency global playback. Consider how you'd handle very large files, adaptive bitrate streaming, and CDN usage.",
        "category": "Media/Streaming",
        "difficulty": "hard",
    },
    {
        "title": "Design a Notification System",
        "prompt_text": "Design a notification system that can send push notifications, emails, and SMS to users at scale, triggered by many different internal services. It should support retries, deduplication, user preferences per channel, and rate limiting per user so they aren't flooded.",
        "category": "Distributed Systems",
        "difficulty": "medium",
    },
    {
        "title": "Design a Distributed Cache",
        "prompt_text": "Design a distributed, in-memory key-value cache (like a simplified Redis/Memcached) that can be shared across many application servers. Consider eviction policies, consistent hashing for sharding, replication for availability, and how clients discover which node owns a given key.",
        "category": "Caching",
        "difficulty": "medium",
    },
    {
        "title": "Design a Web Crawler",
        "prompt_text": "Design a web crawler that can crawl billions of pages, avoid crawling the same page repeatedly, respect robots.txt and politeness/rate limits per domain, and store extracted content for later indexing. Consider how you'd parallelize crawling and detect/handle duplicate content.",
        "category": "Data Systems",
        "difficulty": "medium",
    },
    {
        "title": "Design a Payment/Ledger System",
        "prompt_text": "Design a payment processing and ledger system that records money movements between accounts. It must never lose or double-count a transaction, even under concurrent requests or partial failures. Consider idempotency, consistency guarantees, and how you'd handle retries safely.",
        "category": "Financial Systems",
        "difficulty": "hard",
    },
    {
        "title": "Design a Search Autocomplete",
        "prompt_text": "Design the typeahead/autocomplete system behind a search bar (like Google Search suggestions), returning the top-k likely completions as a user types, updated based on aggregate query popularity. Consider data structures for prefix matching at scale and how suggestion rankings get updated over time.",
        "category": "Data Systems",
        "difficulty": "medium",
    },
    {
        "title": "Design a File Storage & Sync Service",
        "prompt_text": "Design a cloud file storage and sync service like Dropbox: users upload files from multiple devices and expect them kept in sync everywhere, including efficient handling of large files and partial updates. Consider chunking/deduplication, conflict resolution, and metadata storage.",
        "category": "Storage Systems",
        "difficulty": "hard",
    },
    {
        "title": "Design a Distributed Job Scheduler",
        "prompt_text": "Design a job scheduling system (like a distributed cron) that can reliably trigger millions of scheduled and recurring jobs across a fleet of worker machines, ensuring each job runs exactly (or effectively) once even if a worker crashes mid-execution.",
        "category": "Distributed Systems",
        "difficulty": "hard",
    },
    {
        "title": "Design a Leaderboard System",
        "prompt_text": "Design a real-time leaderboard for a game or app with millions of active users, supporting fast lookups of a user's current rank and the top-N players globally, with scores updating continuously and frequently.",
        "category": "Data Systems",
        "difficulty": "easy",
    },
    {
        "title": "Design an Ad Click Aggregation System",
        "prompt_text": "Design a system that ingests a very high-throughput stream of ad click/impression events and produces near-real-time aggregated counts (e.g. clicks per ad per minute) for billing and reporting, while being resilient to duplicate or out-of-order events.",
        "category": "Data Systems",
        "difficulty": "hard",
    },
    {
        "title": "Design a Ride-Sharing Dispatch System",
        "prompt_text": "Design the core matching system for a ride-sharing app like Uber: matching nearby riders and drivers in real time, tracking live driver locations, and handling surge/high-demand periods. Consider geospatial indexing and how you'd keep location data fresh at scale.",
        "category": "Real-Time Systems",
        "difficulty": "hard",
    },
]


def seed_system_design_prompts_if_empty(db: Session) -> int:
    repo = SystemDesignPromptRepository(db)
    if repo.count() > 0:
        return 0

    for p in SEED_SYSTEM_DESIGN_PROMPTS:
        repo.create(SystemDesignPromptCreate(
            title=p["title"],
            prompt_text=p["prompt_text"],
            category=p["category"],
            difficulty=QuestionDifficulty(p["difficulty"]),
            is_ai_generated=False,
        ))
    return len(SEED_SYSTEM_DESIGN_PROMPTS)
