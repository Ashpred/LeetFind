"""
evaluate.py — Full Evaluation + Hybrid Inference Pipeline
Metrics: NDCG@10, Hit Rate@10, Coverage, Diversity
Run: python evaluate.py
"""

import os, sys, json, pickle, ast
import torch
import torch.nn.functional as F
import pandas as pd
import numpy as np
torch.serialization.add_safe_globals([np._core.multiarray.scalar])
from sklearn.metrics.pairwise import cosine_similarity
from tqdm import tqdm

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from models.cf_model    import MatrixFactorization
from models.aux_models  import WeakAreaDetector, HybridScorer

# ── Paths ──────────────────────────────────────────────────────────────────────
DATA_DIR   = '../../data/processed'
RAW_DIR    = '../../data/raw'
EMBED_DIR  = '../../data/embeddings'
MODELS_DIR = '../../saved_models'

TOPICS_LIST = [
    'Array','String','Hash Table','Dynamic Programming','Math',
    'Sorting','Greedy','Depth-First Search','Breadth-First Search',
    'Binary Search','Tree','Graph','Backtracking','Stack','Heap',
    'Linked List','Sliding Window','Two Pointers','Trie','Union Find'
]


# ── Metric helpers ─────────────────────────────────────────────────────────────

def dcg_at_k(relevant_mask, k):
    """Discounted Cumulative Gain at k."""
    mask = relevant_mask[:k]
    positions = np.arange(1, len(mask) + 1)
    return np.sum(mask / np.log2(positions + 1))


def ndcg_at_k(recommended_ids, relevant_ids, k=10):
    """NDCG@k — measures ranking quality."""
    relevant_set = set(relevant_ids)
    mask = np.array([1 if pid in relevant_set else 0 for pid in recommended_ids[:k]])
    ideal = np.ones(min(len(relevant_set), k))
    idcg  = dcg_at_k(ideal, k)
    if idcg == 0:
        return 0.0
    return dcg_at_k(mask, k) / idcg


def hit_rate_at_k(recommended_ids, relevant_ids, k=10):
    """Hit Rate@k — did we recommend at least one relevant item?"""
    return int(bool(set(recommended_ids[:k]) & set(relevant_ids)))


def coverage(all_recs, n_problems):
    """Catalog coverage — % of problems ever recommended."""
    recommended = set(pid for recs in all_recs for pid in recs)
    return len(recommended) / n_problems


def intra_list_diversity(recommended_ids, embeddings, problem_id_to_idx):
    """Average pairwise distance within a recommendation list."""
    idxs = [problem_id_to_idx.get(pid) for pid in recommended_ids if pid in problem_id_to_idx]
    if len(idxs) < 2:
        return 0.0
    embs = embeddings[idxs]
    sims = cosine_similarity(embs)
    n    = len(idxs)
    avg_sim = (sims.sum() - n) / (n * (n - 1))   # exclude diagonal
    return 1 - avg_sim   # diversity = 1 - similarity


# ── Inference pipeline ─────────────────────────────────────────────────────────

class RecommendationEngine:
    """
    Full hybrid inference engine combining:
      1. Collaborative Filtering (Matrix Factorization)
      2. Content-Based (projected embeddings + cosine similarity)
      3. Weak Area Detector (skill gap scoring)
      4. Difficulty Progression (rule-based fit score)
    """

    def __init__(self, device):
        self.device = device
        self._load_data()
        self._load_models()
        print('✅ RecommendationEngine ready\n')

    def _load_data(self):
        print('📂 Loading data artifacts...')
        with open(f'{DATA_DIR}/metadata.json') as f:
            self.meta = json.load(f)
        with open(f'{DATA_DIR}/encoders.pkl', 'rb') as f:
            enc = pickle.load(f)
            self.le_user = enc['le_user']
            self.le_prob = enc['le_prob']

        with open(f'{DATA_DIR}/encoders.pkl', 'wb') as f:
            pickle.dump(enc, f)

        self.problems_df = pd.read_csv(f'{RAW_DIR}/problems.csv')
        self.problems_df['topics'] = self.problems_df['topics'].apply(
            lambda x: ast.literal_eval(x) if isinstance(x, str) else []
        )

        self.user_features_df    = pd.read_csv(f'{DATA_DIR}/user_features.csv')
        print(f"user_features_df shape: {self.user_features_df.shape}")
        print(f"user_id dtype: {self.user_features_df['user_id'].dtype}")
        print(f"Sample user_ids: {self.user_features_df['user_id'].head().tolist()}")
        self.problem_features_df = pd.read_csv(f'{DATA_DIR}/problem_features.csv')

        self.embeddings = np.load(f'{EMBED_DIR}/projected_embeddings.npy')
        self.problem_id_to_idx = {
            pid: i for i, pid in enumerate(self.problems_df['problem_id'])
        }

    def _load_models(self):
        print('🧠 Loading trained models...')

        # CF model
        cf_ckpt = torch.load(f'{MODELS_DIR}/cf_final.pt', weights_only=False, map_location=self.device)
        self.cf = MatrixFactorization(
            n_users    = self.meta['n_users'],
            n_problems = self.meta['n_problems'],
            n_factors  = cf_ckpt['config']['n_factors']
        ).to(self.device)
        self.cf.load_state_dict(cf_ckpt['model_state_dict'])
        self.cf.eval()

       
        # Content projection model
        from models.aux_models import ContentProjectionNet
        self.content = ContentProjectionNet(
            input_dim = self.meta['embed_dim'],   # 384 (raw sentence-transformer dim)
            proj_dim  = 128                        # must match train_content.py CONFIG
        ).to(self.device)
        self.content.load_state_dict(
            torch.load(f'{MODELS_DIR}/content_best.pt', weights_only=False, map_location=self.device)
        )
        self.content.eval()

        # Weak area detector
        sample_u      = self.user_features_df[[c for c in self.user_features_df.columns if c.startswith('skill_')]].iloc[0]
        topic_cols    = [c for c in self.problem_features_df.columns if c.startswith('topic_')]
        num_prob_cols = ['difficulty_num', 'acceptance', 'frequency', 'n_topics']
        self.wa = WeakAreaDetector(
            user_feat_dim = len(sample_u),
            prob_feat_dim = len(topic_cols) + len(num_prob_cols)
        ).to(self.device)
        self.wa.load_state_dict(
            torch.load(f'{MODELS_DIR}/weak_area_best.pt', weights_only=False, map_location=self.device)
        )
        self.wa.eval()

        self.skill_cols    = [c for c in self.user_features_df.columns if c.startswith('skill_')]
        self.topic_cols    = topic_cols
        self.num_prob_cols = num_prob_cols

    def _difficulty_fit_score(self, user_id, problem_difficulty_num):
        """
        Returns a score based on how well problem difficulty matches
        user's current progression level.
        """
        user_row = self.user_features_df[self.user_features_df['user_id'] == user_id]
        if user_row.empty:
            return 0.5

        pct_easy = float(user_row['pct_easy'].iloc[0])
        pct_hard = float(user_row['pct_hard'].iloc[0])

        # Estimate user level: 1=beginner, 2=intermediate, 3=advanced
        if pct_easy > 0.5:
            user_level = 1.2
        elif pct_hard > 0.3:
            user_level = 2.8
        else:
            user_level = 2.0

        # Score peaks when problem difficulty matches user level (Gaussian)
        diff = abs(problem_difficulty_num - user_level)
        return float(np.exp(-0.5 * diff**2))

    @torch.no_grad()
    def recommend(self, user_id: int, n: int = 10, solved_ids: list = None):
        if solved_ids is None:
            solved_ids = set()
        else:
            solved_ids = set(solved_ids)

        # All candidate problems (unsolved)
        candidates = self.problems_df[~self.problems_df['problem_id'].isin(solved_ids)].copy()

        # ── Difficulty filter BEFORE scoring ──────────────────────────────────
        # Move this block up from the bottom — must happen before any array is built
        user_row_pre = self.user_features_df[self.user_features_df['user_id'] == int(user_id)]
        if not user_row_pre.empty:
            pct_hard = float(user_row_pre['pct_hard'].iloc[0])
            if pct_hard > 0.30:
                candidates = candidates[candidates['difficulty'] != 'Easy'].reset_index(drop=True)

        # ── CF scores ─────────────────────────────────────────────────────────
        try:
            user_enc  = self.le_user.transform([user_id])[0]
            prob_encs = self.le_prob.transform(candidates['problem_id'].tolist())

            user_t    = torch.tensor([user_enc] * len(candidates), dtype=torch.long, device=self.device)
            prob_t    = torch.tensor(prob_encs,                    dtype=torch.long, device=self.device)
            cf_scores = self.cf(user_t, prob_t).cpu().numpy()
            cf_scores = (cf_scores - cf_scores.min()) / (cf_scores.max() - cf_scores.min() + 1e-8)
        except Exception:
            cf_scores = np.zeros(len(candidates))

        # ── Content-Based scores ───────────────────────────────────────────────
        cb_scores = np.zeros(len(candidates))
        if solved_ids:
            solved_indices = [
                self.problem_id_to_idx[pid]
                for pid in solved_ids
                if pid in self.problem_id_to_idx
            ]
            if solved_indices:
                user_profile = self.embeddings[solved_indices].mean(axis=0, keepdims=True)
                cand_indices = [self.problem_id_to_idx.get(pid, 0) for pid in candidates['problem_id']]
                cand_embs    = self.embeddings[cand_indices]
                cb_scores    = cosine_similarity(user_profile, cand_embs)[0]
                cb_scores    = (cb_scores - cb_scores.min()) / (cb_scores.max() - cb_scores.min() + 1e-8)
    


        # ── Weak area scores ───────────────────────────────────────────────────
        user_row  = self.user_features_df[self.user_features_df['user_id'] == int(user_id)]
        wa_scores = np.full(len(candidates), 0.5)

        if user_row.empty:
            print(f"⚠️  user_id {user_id} not found in user_features_df")
        else:
            try:
                u_feat_vals = user_row[self.skill_cols].fillna(0).values

                prob_feature_rows = self.problem_features_df[
                    self.problem_features_df['problem_id'].isin(candidates['problem_id'].values)
                ].set_index('problem_id').reindex(candidates['problem_id'].values)

                p_feat_vals = prob_feature_rows[self.topic_cols + self.num_prob_cols].fillna(0).values

                u_feats = torch.tensor(
                    np.repeat(u_feat_vals, len(candidates), axis=0),
                    dtype=torch.float32, device=self.device
                )
                p_feats = torch.tensor(
                    p_feat_vals,
                    dtype=torch.float32, device=self.device
                )

                wa_scores = self.wa.weakness_score(u_feats, p_feats).cpu().numpy().flatten()

                # Modulate by difficulty — easy problems get dampened WA boost
                difficulty_multiplier = np.array([
                    {'Easy': 0.3, 'Medium': 0.8, 'Hard': 1.2}.get(d, 0.8)
                    for d in candidates['difficulty']
                ])
                wa_scores = wa_scores * difficulty_multiplier

            except Exception as e:
                print(f"⚠️  WA scoring failed for user {user_id}: {e}")

        # ── Difficulty fit scores ──────────────────────────────────────────────
        diff_scores = np.array([
            self._difficulty_fit_score(user_id, d)
            for d in candidates['difficulty_num']
        ])

        # ── Hybrid combination ─────────────────────────────────────────────────
        # Sanity check — all arrays must be same length
        assert len(cf_scores) == len(cb_scores) == len(wa_scores) == len(diff_scores) == len(candidates), \
            f"Score array length mismatch! cf={len(cf_scores)} cb={len(cb_scores)} wa={len(wa_scores)} diff={len(diff_scores)} cands={len(candidates)}"

        final_scores = (
            0.40 * cf_scores +
            0.30 * cb_scores +
            0.15 * wa_scores +
            0.15 * diff_scores
        )

        # Soft penalty for very high CF scores — improves coverage
        cf_penalty   = np.where(cf_scores > 0.75, 0.10, 0.0)
        final_scores = final_scores - cf_penalty

        # ── Top-n selection ────────────────────────────────────────────────────
        top_indices  = np.argsort(final_scores)[::-1][:n]
        top_problems = candidates.iloc[top_indices].copy()
        top_problems['score']      = final_scores[top_indices]
        top_problems['cf_score']   = cf_scores[top_indices]
        top_problems['cb_score']   = cb_scores[top_indices]
        top_problems['wa_score']   = wa_scores[top_indices]
        top_problems['diff_score'] = diff_scores[top_indices]

        return top_problems.to_dict('records')


# ── Batch evaluation ───────────────────────────────────────────────────────────

def run_evaluation(engine, test_df, n_eval_users=200, k=10):
    """
    Evaluate recommendation quality on held-out test interactions.
    Strategy: for each user, use their train history to recommend,
              then check if test problems appear in top-k.
    """
    print(f'\n📊 Running evaluation on {n_eval_users} users (k={k})...')

    train_df = pd.read_csv(f'{DATA_DIR}/train.csv')
    interactions_df = pd.read_csv(f'{DATA_DIR}/../raw/interactions.csv')
    interactions_df['solved_at'] = pd.to_datetime(
        interactions_df['solved_at'], errors='coerce'
    )

    # Sample users who appear in test set
    test_users = test_df['user_id'].unique()
    eval_users = np.random.choice(test_users, size=min(n_eval_users, len(test_users)), replace=False)

    ndcg_scores, hit_rates, all_recs = [], [], []

    print(f"test_df user_id dtype: {test_df['user_id'].dtype}")
    print(f"train_df user_id dtype: {train_df['user_id'].dtype}")
    print(f"Sample test user_ids: {test_df['user_id'].head().tolist()}")

    for uid in tqdm(eval_users, desc='Evaluating'):
        user_ints = interactions_df[
        interactions_df['user_id'] == uid
        ].sort_values('solved_at')

        if len(user_ints) < 10:
            continue

        # Use last 10% of solves as ground truth
        split_idx    = int(len(user_ints) * 0.9)
        train_solved = user_ints.iloc[:split_idx]['problem_id'].tolist()
        test_solved  = user_ints.iloc[split_idx:]['problem_id'].tolist()

        if len([x for x in eval_users[:5] if x == uid]) > 0:
            print(f"\nUser {uid}: train_solved={len(train_solved)} test_solved={len(test_solved)}")    


        if not test_solved:
            continue

        recs = engine.recommend(user_id=uid, n=k, solved_ids=train_solved)
        rec_ids = [r['problem_id'] for r in recs]

        ndcg_scores.append(ndcg_at_k(rec_ids, test_solved, k=k))
        hit_rates.append(hit_rate_at_k(rec_ids, test_solved, k=k))
        all_recs.append(rec_ids)

    n_problems = len(engine.problems_df)
    cov = coverage(all_recs, n_problems)

    # Diversity
    div_scores = [
        intra_list_diversity(recs, engine.embeddings, engine.problem_id_to_idx)
        for recs in all_recs
    ]

    print(f'\n{"="*50}')
    print(f'  📈 Evaluation Results (k={k})')
    print(f'{"="*50}')
    print(f'  NDCG@{k}:      {np.mean(ndcg_scores):.4f}')
    print(f'  Hit Rate@{k}:  {np.mean(hit_rates):.4f}')
    print(f'  Coverage:     {cov:.4f}  ({cov*100:.1f}% of catalog)')
    print(f'  Diversity:    {np.mean(div_scores):.4f}')
    print(f'{"="*50}\n')

    return {
        'ndcg':      float(np.mean(ndcg_scores)),
        'hit_rate':  float(np.mean(hit_rates)),
        'coverage':  float(cov),
        'diversity': float(np.mean(div_scores))
    }


def demo_recommendation(engine, user_id=0):
    """Show sample recommendations for a user."""
    train_df   = pd.read_csv(f'{DATA_DIR}/train.csv')
    solved_ids = train_df[train_df['user_id'] == user_id]['problem_id'].tolist()

    print(f'\n🎯 Top 10 Recommendations for User {user_id}')
    print(f'   (Has solved {len(solved_ids)} problems)\n')

    recs = engine.recommend(user_id=user_id, n=10, solved_ids=solved_ids)

    print(f'{"#":<3} {"Title":<40} {"Diff":<8} {"Score":<7} {"CF":<6} {"CB":<6} {"WA":<6}')
    print('-' * 80)
    for i, r in enumerate(recs, 1):
        title = r['title'][:38]
        print(f'{i:<3} {title:<40} {r["difficulty"]:<8} '
              f'{r["score"]:.3f}  {r["cf_score"]:.3f} {r["cb_score"]:.3f} {r["wa_score"]:.3f}')


def main():
    print('=' * 60)
    print('  LeetCode Recommender — Evaluation')
    print('=' * 60)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    engine = RecommendationEngine(device)

    # Load test data
    test_df = pd.read_csv(f'{DATA_DIR}/test.csv')

    # Run full evaluation
    for k in [5, 10, 20]:
        print(f'\n--- k={k} ---')
        metrics = run_evaluation(engine, test_df, n_eval_users=1000, k=k)

    # Save metrics
    with open(f'{MODELS_DIR}/eval_metrics.json', 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f'✅ Metrics saved → {MODELS_DIR}/eval_metrics.json')

    # Demo recommendations
    demo_recommendation(engine, user_id=42)

    print('\n🎉 All 3 models trained and evaluated!')
    print('➡️  Next: wrap engine in FastAPI → then MERN frontend')


if __name__ == '__main__':
    main()
