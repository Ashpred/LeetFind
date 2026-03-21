"""
engine.py — Production RecommendationEngine for FastAPI
Wraps the trained ML models into clean inference methods
"""

import os
import sys
import json
import pickle
import ast
import logging
import torch
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Optional

log = logging.getLogger(__name__)

# ── Paths — relative to ml-service/ ──────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR  = os.path.join(BASE_DIR, '..', '..', 'saved_models')
DATA_DIR    = os.path.join(BASE_DIR, '..', '..', 'data', 'processed')
RAW_DIR     = os.path.join(BASE_DIR, '..', '..', 'data', 'raw')
EMBED_DIR   = os.path.join(BASE_DIR, '..', '..', 'data', 'embeddings')

# Add ml/ to path so we can import model architectures
ML_DIR = os.path.join(BASE_DIR, '..', '..', 'model', 'ml')
sys.path.append(ML_DIR)

from models.cf_model   import MatrixFactorization
from models.aux_models import WeakAreaDetector, ContentProjectionNet

TOPICS_LIST = [
    'Array','String','Hash Table','Dynamic Programming','Math',
    'Sorting','Greedy','Depth-First Search','Breadth-First Search',
    'Binary Search','Tree','Graph','Backtracking','Stack','Heap',
    'Linked List','Sliding Window','Two Pointers','Trie','Union Find'
]


class RecommendationEngine:

    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        log.info(f'Device: {self.device}')
        self._models_loaded = False
        self._load_data()
        self._load_models()
        self._models_loaded = True

    def models_loaded(self) -> bool:
        return self._models_loaded

    # ── Data loading ──────────────────────────────────────────────────────────

    def _load_data(self):
        log.info('📂 Loading data artifacts...')

        with open(os.path.join(DATA_DIR, 'metadata.json')) as f:
            self.meta = json.load(f)

        with open(os.path.join(DATA_DIR, 'encoders.pkl'), 'rb') as f:
            enc = pickle.load(f)
            self.le_user = enc['le_user']
            self.le_prob = enc['le_prob']

        self.problems_df = pd.read_csv(os.path.join(RAW_DIR, 'problems.csv'))
        self.problems_df['topics'] = self.problems_df['topics'].apply(
            lambda x: ast.literal_eval(x) if isinstance(x, str) else []
        )

        self.user_features_df    = pd.read_csv(os.path.join(DATA_DIR, 'user_features.csv'))
        self.problem_features_df = pd.read_csv(os.path.join(DATA_DIR, 'problem_features.csv'))

        self.embeddings = np.load(os.path.join(EMBED_DIR, 'projected_embeddings.npy'))

        self.problem_id_to_idx = {
            pid: i for i, pid in enumerate(self.problems_df['problem_id'])
        }

        self.skill_cols    = [c for c in self.user_features_df.columns   if c.startswith('skill_')]
        self.topic_cols    = [c for c in self.problem_features_df.columns if c.startswith('topic_')]
        self.num_prob_cols = ['difficulty_num', 'acceptance', 'frequency', 'n_topics']

        log.info(f'✅ Loaded {len(self.problems_df)} problems, {len(self.user_features_df)} user profiles')

    # ── Model loading ─────────────────────────────────────────────────────────

    def _load_models(self):
        log.info('🧠 Loading trained models...')

        torch.serialization.add_safe_globals([np._core.multiarray.scalar])

        # CF model
        cf_ckpt  = torch.load(
            os.path.join(MODELS_DIR, 'cf_final.pt'),
            weights_only = False,
            map_location = self.device
        )
        self.cf  = MatrixFactorization(
            n_users    = self.meta['n_users'],
            n_problems = self.meta['n_problems'],
            n_factors  = cf_ckpt['config']['n_factors']
        ).to(self.device)
        self.cf.load_state_dict(cf_ckpt['model_state_dict'])
        self.cf.eval()

        # Content projection model
        self.content = ContentProjectionNet(
            input_dim = self.meta['embed_dim'],
            proj_dim  = 128
        ).to(self.device)
        self.content.load_state_dict(torch.load(
            os.path.join(MODELS_DIR, 'content_best.pt'),
            weights_only = False,
            map_location = self.device
        ))
        self.content.eval()

        # Weak area detector
        sample_u      = self.user_features_df[self.skill_cols].iloc[0]
        self.wa       = WeakAreaDetector(
            user_feat_dim = len(sample_u),
            prob_feat_dim = len(self.topic_cols) + len(self.num_prob_cols)
        ).to(self.device)
        self.wa.load_state_dict(torch.load(
            os.path.join(MODELS_DIR, 'weak_area_best.pt'),
            weights_only = False,
            map_location = self.device
        ))
        self.wa.eval()

        log.info('✅ All 3 models loaded')

    # ── Core inference methods ─────────────────────────────────────────────────

    @torch.no_grad()
    def recommend(
        self,
        user_id:    int,
        n:          int           = 10,
        solved_ids: List[int]     = None,
        topic:      Optional[str] = None,
        difficulty: Optional[str] = None,
    ) -> List[dict]:
        """
        Full hybrid recommendation pipeline.
        Returns list of problem dicts with score breakdown.
        """
        solved_ids = set(solved_ids or [])

        # ── Candidate filtering ────────────────────────────────────────────────
        candidates = self.problems_df[
            ~self.problems_df['problem_id'].isin(solved_ids)
        ].copy()

        # Optional filters
        if topic:
            candidates = candidates[
                candidates['topics'].apply(lambda ts: topic in ts)
            ]
        if difficulty:
            candidates = candidates[candidates['difficulty'] == difficulty]

        # Filter easy problems for advanced users
        user_row = self.user_features_df[
            self.user_features_df['user_id'] == int(user_id)
        ]
        if not user_row.empty:
            pct_hard = float(user_row['pct_hard'].iloc[0])
            if pct_hard > 0.30 and not difficulty:
                candidates = candidates[candidates['difficulty'] != 'Easy']

        candidates = candidates.reset_index(drop=True)

        if len(candidates) == 0:
            return []

        # ── CF scores ─────────────────────────────────────────────────────────
        cf_scores = self._cf_scores(user_id, candidates)

        # ── Content-Based scores ───────────────────────────────────────────────
        cb_scores = self._cb_scores(solved_ids, candidates)

        # ── Weak area scores ───────────────────────────────────────────────────
        wa_scores = self._wa_scores(user_id, candidates)

        # ── Difficulty fit scores ──────────────────────────────────────────────
        diff_scores = np.array([
            self._difficulty_fit(user_id, d)
            for d in candidates['difficulty_num']
        ])

        # ── Hybrid combination ─────────────────────────────────────────────────
        final_scores = (
            0.40 * cf_scores +
            0.30 * cb_scores +
            0.15 * wa_scores +
            0.15 * diff_scores
        )

        # Soft CF penalty for coverage
        cf_penalty   = np.where(cf_scores > 0.75, cf_scores * 0.10, 0.0)
        final_scores = final_scores - cf_penalty

        # ── Top-n ──────────────────────────────────────────────────────────────
        top_idx      = np.argsort(final_scores)[::-1][:n]
        top_problems = candidates.iloc[top_idx]

        results = []
        for i, (_, row) in enumerate(top_problems.iterrows()):
            idx = top_idx[i]
            results.append({
                'problem_id': int(row['problem_id']),
                'title':      row['title'],
                'slug':       row['slug'],
                'difficulty': row['difficulty'],
                'topics':     row['topics'],
                'acceptance': float(row['acceptance']),
                'score':      float(final_scores[idx]),
                'cf_score':   float(cf_scores[idx]),
                'cb_score':   float(cb_scores[idx]),
                'wa_score':   float(wa_scores[idx]),
                'diff_score': float(diff_scores[idx]),
            })

        return results

    @torch.no_grad()
    def get_similar_problems(self, problem_id: int, k: int = 5) -> List[dict]:
        """
        Content-based similar problems using projected embeddings.
        Called by Problems Service for the Similar Problems section.
        """
        if problem_id not in self.problem_id_to_idx:
            raise ValueError(f'problem_id {problem_id} not found')

        idx   = self.problem_id_to_idx[problem_id]
        query = self.embeddings[idx:idx+1]
        sims  = cosine_similarity(query, self.embeddings)[0]

        # Exclude self
        sims[idx] = -1
        top_idx   = np.argsort(sims)[::-1][:k]

        results = []
        for i in top_idx:
            row = self.problems_df.iloc[i]
            results.append({
                'problem_id': int(row['problem_id']),
                'title':      row['title'],
                'slug':       row['slug'],
                'difficulty': row['difficulty'],
                'topics':     row['topics'],
                'similarity': float(sims[i]),
            })

        return results

    def update_skill_vector(self, user_id: int, solves: List[dict]) -> List[float]:
        """
        Recompute skill vector from a user's full solve history.
        Called after each new solve — fire and forget from Solves Service.
        """
        topic_stats = {t: {'solved': 0, 'total_time': 0, 'attempts': 0} for t in TOPICS_LIST}

        for solve in solves:
            for topic in solve.get('topics', []):
                if topic in topic_stats:
                    topic_stats[topic]['solved']     += 1
                    topic_stats[topic]['total_time'] += solve.get('time_taken', 0)
                    topic_stats[topic]['attempts']   += solve.get('attempts', 1)

        skill_vector = []
        for topic in TOPICS_LIST:
            stats    = topic_stats[topic]
            solved   = stats['solved']
            avg_time = stats['total_time'] / max(solved, 1)
            attempts = stats['attempts']

            if solved == 0:
                skill_vector.append(0.0)
            else:
                mastery = (solved / max(attempts, 1)) * (1 / np.log1p(avg_time))
                skill_vector.append(float(np.clip(mastery, 0, 1)))

        return skill_vector

    # ── Private scoring helpers ────────────────────────────────────────────────

    def _cf_scores(self, user_id: int, candidates: pd.DataFrame) -> np.ndarray:
        try:
            user_enc  = self.le_user.transform([user_id])[0]
            prob_encs = self.le_prob.transform(candidates['problem_id'].tolist())
            user_t    = torch.tensor([user_enc] * len(candidates), dtype=torch.long, device=self.device)
            prob_t    = torch.tensor(prob_encs,                    dtype=torch.long, device=self.device)
            scores    = self.cf(user_t, prob_t).cpu().numpy()
            return (scores - scores.min()) / (scores.max() - scores.min() + 1e-8)
        except Exception as e:
            log.warning(f'CF scoring failed for user {user_id}: {e} — using zeros')
            return np.zeros(len(candidates))

    def _cb_scores(self, solved_ids: set, candidates: pd.DataFrame) -> np.ndarray:
        if not solved_ids:
            return np.zeros(len(candidates))
        solved_indices = [
            self.problem_id_to_idx[pid]
            for pid in solved_ids
            if pid in self.problem_id_to_idx
        ]
        if not solved_indices:
            return np.zeros(len(candidates))

        user_profile = self.embeddings[solved_indices].mean(axis=0, keepdims=True)
        cand_indices = [self.problem_id_to_idx.get(pid, 0) for pid in candidates['problem_id']]
        cand_embs    = self.embeddings[cand_indices]
        scores       = cosine_similarity(user_profile, cand_embs)[0]
        return (scores - scores.min()) / (scores.max() - scores.min() + 1e-8)

    def _wa_scores(self, user_id: int, candidates: pd.DataFrame) -> np.ndarray:
        user_row = self.user_features_df[self.user_features_df['user_id'] == int(user_id)]
        if user_row.empty:
            return np.full(len(candidates), 0.5)

        try:
            u_feat_vals = user_row[self.skill_cols].fillna(0).values
            prob_rows   = self.problem_features_df[
                self.problem_features_df['problem_id'].isin(candidates['problem_id'].values)
            ].set_index('problem_id').reindex(candidates['problem_id'].values)

            p_feat_vals = prob_rows[self.topic_cols + self.num_prob_cols].fillna(0).values

            u_feats = torch.tensor(
                np.repeat(u_feat_vals, len(candidates), axis=0),
                dtype=torch.float32, device=self.device
            )
            p_feats = torch.tensor(p_feat_vals, dtype=torch.float32, device=self.device)

            wa_scores = self.wa.weakness_score(u_feats, p_feats).cpu().numpy().flatten()

            # Modulate by difficulty
            diff_mult = np.array([
                {'Easy': 0.3, 'Medium': 0.8, 'Hard': 1.2}.get(d, 0.8)
                for d in candidates['difficulty']
            ])
            return wa_scores * diff_mult

        except Exception as e:
            log.warning(f'WA scoring failed: {e}')
            return np.full(len(candidates), 0.5)

    def _difficulty_fit(self, user_id: int, difficulty_num: float) -> float:
        user_row = self.user_features_df[self.user_features_df['user_id'] == int(user_id)]
        if user_row.empty:
            return 0.5
        pct_easy = float(user_row['pct_easy'].iloc[0])
        pct_hard = float(user_row['pct_hard'].iloc[0])
        user_level = 1.2 if pct_easy > 0.5 else (2.8 if pct_hard > 0.3 else 2.0)
        return float(np.exp(-0.5 * (difficulty_num - user_level) ** 2))
