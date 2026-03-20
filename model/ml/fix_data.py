"""
fix_data.py — Inject negative interactions to fix class imbalance
Run once: python fix_data.py
"""

import pandas as pd
import numpy as np
import os

RAW_DIR  = '../../data/raw'
PROC_DIR = '../../data/processed'
SEED     = 42
np.random.seed(SEED)

print('📂 Loading existing data...')
interactions_df = pd.read_csv(f'{RAW_DIR}/interactions.csv')
problems_df     = pd.read_csv(f'{RAW_DIR}/problems.csv')
users_df        = pd.read_csv(f'{RAW_DIR}/users.csv')

print(f'   Existing interactions: {len(interactions_df):,}')
print(f'   Positive rate: {(interactions_df["rating"] == 1.0).mean():.3%}')

# ── Build lookup of what each user has already solved ────────────────────────
user_solved = interactions_df.groupby('user_id')['problem_id'].apply(set).to_dict()
all_problem_ids = problems_df['problem_id'].tolist()

# ── Generate negatives ────────────────────────────────────────────────────────
# Strategy: for each user, sample ~15% of unsolved problems as negatives
# rating=0.0 → never attempted, rating=0.3 → attempted but gave up

print('\n⏳ Generating negative interactions...')
negative_rows = []

for uid, solved_set in user_solved.items():
    unsolved = [pid for pid in all_problem_ids if pid not in solved_set]
    
    if not unsolved:
        continue

    # Sample negatives = 20% of how many they solved (keeps ~80/20 ratio)
    n_neg = max(1, int(len(solved_set) * 0.20))
    n_neg = min(n_neg, len(unsolved))
    
    sampled_neg = np.random.choice(unsolved, size=n_neg, replace=False)
    
    for pid in sampled_neg:
        # Mix of never-attempted (0.0) and gave-up (0.3)
        rating = 0.0 if np.random.random() < 0.6 else 0.3
        negative_rows.append({
            'user_id':    uid,
            'problem_id': pid,
            'rating':     rating,
            'time_taken': 0,
            'attempts':   0 if rating == 0.0 else np.random.randint(1, 5),
            'solved_at':  None
        })

negatives_df = pd.DataFrame(negative_rows)
print(f'   Generated negatives: {len(negatives_df):,}')

# ── Combine and shuffle ───────────────────────────────────────────────────────
combined_df = pd.concat([interactions_df, negatives_df], ignore_index=True)
combined_df = combined_df.sample(frac=1, random_state=SEED).reset_index(drop=True)

pos_rate = (combined_df['rating'] == 1.0).mean()
print(f'\n✅ Combined dataset: {len(combined_df):,} interactions')
print(f'   Positive rate: {pos_rate:.3%}')
print(f'   Negative rate: {1-pos_rate:.3%}')

# ── Re-encode indices ─────────────────────────────────────────────────────────
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
import pickle

le_user = LabelEncoder()
le_prob = LabelEncoder()
combined_df['user_idx']    = le_user.fit_transform(combined_df['user_id'])
combined_df['problem_idx'] = le_prob.fit_transform(combined_df['problem_id'])

# ── Re-split ──────────────────────────────────────────────────────────────────
train_df, temp_df = train_test_split(combined_df, test_size=0.2, random_state=SEED)
val_df,   test_df = train_test_split(temp_df,      test_size=0.5, random_state=SEED)

print(f'\n   Train: {len(train_df):,} | Val: {len(val_df):,} | Test: {len(test_df):,}')

# ── Save ──────────────────────────────────────────────────────────────────────
combined_df.to_csv(f'{RAW_DIR}/interactions.csv',       index=False)
train_df.to_csv(f'{PROC_DIR}/train.csv',                index=False)
val_df.to_csv(f'{PROC_DIR}/val.csv',                    index=False)
test_df.to_csv(f'{PROC_DIR}/test.csv',                  index=False)

# Update encoders
with open(f'{PROC_DIR}/encoders.pkl', 'rb') as f:
    enc = pickle.load(f)
enc['le_user'] = le_user
enc['le_prob'] = le_prob
with open(f'{PROC_DIR}/encoders.pkl', 'wb') as f:
    pickle.dump(enc, f)

print('\n✅ All files updated!')
print(f'   interactions.csv  — {len(combined_df):,} rows')
print(f'   train/val/test    — re-split with negatives included')
print(f'   encoders.pkl      — re-saved with new indices')
print('\n➡️  Now retrain: python train_weak_area.py')