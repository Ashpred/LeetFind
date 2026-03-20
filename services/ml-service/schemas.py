"""
schemas.py — Pydantic models for request/response validation
"""

from pydantic import BaseModel
from typing import List, Optional


# ── Recommendation schemas ─────────────────────────────────────────────────────

class RecommendedProblem(BaseModel):
    problem_id:  int
    title:       str
    slug:        str
    difficulty:  str
    topics:      List[str]
    acceptance:  float
    score:       float
    cf_score:    float
    cb_score:    float
    wa_score:    float
    diff_score:  float


class RecommendationResponse(BaseModel):
    user_id:         int
    recommendations: List[RecommendedProblem]
    count:           int
    elapsed_ms:      float


# ── Skill update schemas ───────────────────────────────────────────────────────

class SolveEntry(BaseModel):
    problem_id: int
    rating:     float         # 1.0 = clean solve, 0.7 = struggled
    time_taken: int           # seconds
    attempts:   int
    topics:     List[str]
    difficulty: str


class UpdateSkillRequest(BaseModel):
    solves: List[SolveEntry]


class UpdateSkillResponse(BaseModel):
    user_id:      int
    skill_vector: List[float]
    n_topics:     int


# ── Similar problems schemas ───────────────────────────────────────────────────

class SimilarProblem(BaseModel):
    problem_id:  int
    title:       str
    slug:        str
    difficulty:  str
    topics:      List[str]
    similarity:  float


class SimilarProblemsResponse(BaseModel):
    problem_id:       int
    similar_problems: List[SimilarProblem]
    count:            int


# ── Health schema ─────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status:  str
    models:  bool
    version: str
