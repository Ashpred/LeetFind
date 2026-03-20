"""
main.py — FastAPI ML Service Entry Point
Port: 8000
Run: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import logging
import time

from engine import RecommendationEngine
from schemas import (
    RecommendationResponse,
    UpdateSkillRequest,
    UpdateSkillResponse,
    SimilarProblemsResponse,
    HealthResponse,
)

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level   = logging.INFO,
    format  = '%(asctime)s | %(levelname)s | %(message)s',
    datefmt = '%H:%M:%S'
)
log = logging.getLogger(__name__)

# ── Global engine instance ────────────────────────────────────────────────────
engine: RecommendationEngine = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML models at startup, clean up at shutdown."""
    global engine
    log.info('🚀 Loading RecommendationEngine...')
    start = time.time()
    engine = RecommendationEngine()
    log.info(f'✅ Engine ready in {time.time() - start:.2f}s')
    yield
    log.info('🛑 Shutting down ML service...')


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title       = 'LeetCode Recommender — ML Service',
    description = 'Hybrid recommendation engine: CF + Content + Weak Area',
    version     = '1.0.0',
    lifespan    = lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins  = ['http://localhost:3000'],   # API Gateway only
    allow_methods  = ['GET', 'POST'],
    allow_headers  = ['*'],
)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get('/health', response_model=HealthResponse)
async def health():
    """Liveness check — called by gateway on startup."""
    return {
        'status':  'ok',
        'models':  engine.models_loaded() if engine else False,
        'version': '1.0.0'
    }


@app.get('/recommend/{user_id}', response_model=RecommendationResponse)
async def recommend(
    user_id:    int,
    n:          int = Query(default=10, ge=1, le=50),
    topic:      str = Query(default=None),
    difficulty: str = Query(default=None),
):
    """
    Get top-n recommendations for a user.
    Called by Recommendations Service.
    """
    if not engine:
        raise HTTPException(status_code=503, detail='ML engine not ready')

    try:
        start      = time.time()
        # Fetch user's solved problems from request context
        # (passed by Recommendations Service)
        recs       = engine.recommend(
            user_id    = user_id,
            n          = n,
            topic      = topic,
            difficulty = difficulty,
        )
        elapsed    = time.time() - start
        log.info(f'✅ Recommended {len(recs)} problems for user {user_id} in {elapsed:.3f}s')

        return {
            'user_id':         user_id,
            'recommendations': recs,
            'count':           len(recs),
            'elapsed_ms':      round(elapsed * 1000, 2)
        }

    except Exception as e:
        log.error(f'❌ Recommendation failed for user {user_id}: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/update-skill/{user_id}', response_model=UpdateSkillResponse)
async def update_skill(user_id: int, body: UpdateSkillRequest):
    """
    Recompute skill vector for a user after a new solve.
    Called async by Solves Service — fire and forget.
    """
    if not engine:
        raise HTTPException(status_code=503, detail='ML engine not ready')

    try:
        skill_vector = engine.update_skill_vector(
            user_id  = user_id,
            solves   = body.solves
        )
        log.info(f'✅ Skill vector updated for user {user_id}')
        return {
            'user_id':      user_id,
            'skill_vector': skill_vector,
            'n_topics':     len(skill_vector)
        }

    except Exception as e:
        log.error(f'❌ Skill update failed for user {user_id}: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/similar/{problem_id}', response_model=SimilarProblemsResponse)
async def similar_problems(
    problem_id: int,
    k:          int = Query(default=5, ge=1, le=20)
):
    """
    Get k most similar problems based on content embeddings.
    Called by Problems Service for the 'Similar Problems' section.
    """
    if not engine:
        raise HTTPException(status_code=503, detail='ML engine not ready')

    try:
        similar = engine.get_similar_problems(problem_id=problem_id, k=k)
        log.info(f'✅ Found {len(similar)} similar problems for problem {problem_id}')
        return {
            'problem_id':       problem_id,
            'similar_problems': similar,
            'count':            len(similar)
        }

    except Exception as e:
        log.error(f'❌ Similar problems failed for problem {problem_id}: {e}')
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == '__main__':
    uvicorn.run('main:app', host='0.0.0.0', port=8000, reload=True)
