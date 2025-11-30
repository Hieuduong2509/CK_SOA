from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import httpx
import redis
import os

app = FastAPI(
    title="Search Service API",
    description="Search and autocomplete microservice",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://localhost:8002")
PROJECT_SERVICE_URL = os.getenv("PROJECT_SERVICE_URL", "http://localhost:8003")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/3")

redis_client = redis.from_url(REDIS_URL)


@app.get("/api/v1/search/freelancers")
async def search_freelancers(
    q: Optional[str] = None,
    skills: Optional[str] = None,
    rating: Optional[float] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    categories: Optional[str] = None,
    badges: Optional[str] = None,
    experience_level: Optional[str] = None,
    location: Optional[str] = None,
    sort: str = "rating",
    limit: int = 20,
    offset: int = 0
):
    # If no query and no filters, increase limit to get all freelancers
    has_query = q and q.strip()
    has_filters = any([skills, rating, price_min, price_max, categories, badges, experience_level, location])
    
    if not has_query and not has_filters:
        limit = 100  # Get all freelancers when no filters
    
    # Call user service
    params = {
        "limit": limit,
        "offset": offset
    }
    if skills:
        params["skills"] = skills
    if rating:
        params["rating_min"] = rating
    if price_min:
        params["price_min"] = price_min
    if price_max:
        params["price_max"] = price_max
    if categories:
        params["categories"] = categories
    if badges:
        params["badges"] = badges
    if experience_level:
        params["experience_level"] = experience_level
    if location:
        params["location"] = location
    if q:
        params["query"] = q
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{USER_SERVICE_URL}/api/v1/users", params=params)
            if response.status_code == 200:
                freelancers = response.json()
                # Sorting logic
                if sort == "rating":
                    freelancers.sort(key=lambda f: f.get("rating", 0), reverse=True)
                elif sort == "price_asc":
                    freelancers.sort(key=lambda f: f.get("starting_price", float('inf')))
                elif sort == "price_desc":
                    freelancers.sort(key=lambda f: f.get("starting_price", float('-inf')), reverse=True)
                return freelancers
            else:
                print(f"User service returned {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Error calling user service: {e}")
    return []


@app.get("/api/v1/search/autocomplete")
async def autocomplete(query: str = Query(..., min_length=1)):
    # Cache common searches
    cache_key = f"autocomplete:{query}"
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # Mock autocomplete - in production, use Elasticsearch or similar
    suggestions = []
    if len(query) >= 2:
        common_skills = ["Python", "JavaScript", "React", "Node.js", "UI/UX", "Figma", "Photoshop"]
        suggestions = [s for s in common_skills if query.lower() in s.lower()][:5]
    
    redis_client.setex(cache_key, 3600, json.dumps(suggestions))
    return suggestions


@app.post("/api/v1/search/match")
async def match_freelancers(brief: dict):
    """Match freelancers based on project brief"""
    required_skills = brief.get("skills", [])
    budget = brief.get("budget", 0)
    
    # Call user service with filters
    params = {
        "skills": ",".join(required_skills),
        "price_max": budget * 1.2,  # Allow 20% over budget
        "rating_min": 4.0,
        "limit": 10
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{USER_SERVICE_URL}/api/v1/users", params=params)
        if response.status_code == 200:
            freelancers = response.json()
            # Simple scoring
            for f in freelancers:
                score = 0
                skills_match = len(set(required_skills) & set(f.get("skills", [])))
                score += skills_match * 10
                score += f.get("rating", 0) * 5
                f["match_score"] = score
            
            freelancers.sort(key=lambda x: x.get("match_score", 0), reverse=True)
            return freelancers[:5]
    return []


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "search-service"}

import json

