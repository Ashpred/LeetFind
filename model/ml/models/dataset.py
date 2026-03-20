"""
dataset.py — PyTorch Dataset classes for all 3 model components
"""

import torch
from torch.utils.data import Dataset
import pandas as pd
import numpy as np


class InteractionDataset(Dataset):
    """
    Dataset for Collaborative Filtering.
    Each sample: (user_idx, problem_idx, rating)
    """

    def __init__(self, df: pd.DataFrame):
        self.user_idx    = torch.tensor(df['user_idx'].values,    dtype=torch.long)
        self.problem_idx = torch.tensor(df['problem_idx'].values, dtype=torch.long)
        self.ratings     = torch.tensor(df['rating'].values,      dtype=torch.float32)

    def __len__(self):
        return len(self.ratings)

    def __getitem__(self, idx):
        return (
            self.user_idx[idx],
            self.problem_idx[idx],
            self.ratings[idx]
        )


class ContentDataset(Dataset):
    """
    Dataset for Content-Based similarity training.
    Each sample: (anchor_emb, positive_emb, negative_emb)
    Triplet loss: anchor and positive share a topic, negative does not.
    """

    def __init__(self, embeddings: np.ndarray, problems_df: pd.DataFrame, n_triplets: int = 50000):
        self.embeddings  = torch.tensor(embeddings, dtype=torch.float32)
        self.problems_df = problems_df.reset_index(drop=True)
        self.n_triplets  = n_triplets
        self.triplets    = self._build_triplets()

    def _build_triplets(self):
    # Precompute topic → problem indices map ONCE
        topic_to_indices = {}
        for i, row in self.problems_df.iterrows():
            for topic in row['topics']:
                topic_to_indices.setdefault(topic, []).append(i)

        all_indices = set(self.problems_df.index.tolist())
        triplets = []

        for _ in range(self.n_triplets):
            anchor_idx    = np.random.choice(self.problems_df.index)
            anchor_topics = set(self.problems_df.at[anchor_idx, 'topics'])

            if not anchor_topics:
                continue

            # O(1) lookup instead of full scan
            pos_candidates = list(
                {i for t in anchor_topics for i in topic_to_indices.get(t, [])} - {anchor_idx}
            )
            neg_candidates = list(
                all_indices - {i for t in anchor_topics for i in topic_to_indices.get(t, [])}
            )

            if not pos_candidates or not neg_candidates:
                continue

            triplets.append((
                anchor_idx,
                np.random.choice(pos_candidates),
                np.random.choice(neg_candidates)
            ))

        return triplets

    def __len__(self):
        return len(self.triplets)

    def __getitem__(self, idx):
        a, p, n = self.triplets[idx]
        return self.embeddings[a], self.embeddings[p], self.embeddings[n]


class UserProblemFeatureDataset(Dataset):
    """
    Dataset for Weak Area Detector.
    Each sample: (user_skill_vector, problem_feature_vector, label)
    label = 1 if user solved, 0 if not (for classification head)
    """

    def __init__(self, interactions_df: pd.DataFrame,
                 user_features_df: pd.DataFrame,
                 problem_features_df: pd.DataFrame):

        skill_cols   = [c for c in user_features_df.columns   if c.startswith('skill_')]
        topic_cols   = [c for c in problem_features_df.columns if c.startswith('topic_')]
        num_prob_cols = ['difficulty_num', 'acceptance', 'frequency', 'n_topics']

        merged = interactions_df[['user_id', 'problem_id', 'rating']].merge(
            user_features_df[['user_id'] + skill_cols], on='user_id', how='left'
        ).merge(
            problem_features_df[['problem_id'] + topic_cols + num_prob_cols],
            on='problem_id', how='left'
        ).dropna()

        # Check class balance
        n_pos = (self.labels == 1).sum().item()
        n_neg = (self.labels == 0).sum().item()
        print(f"  Dataset balance → Positive: {n_pos:,} | Negative: {n_neg:,} | Ratio: {n_pos/max(n_neg,1):.2f}x")

        # Undersample positives to 2:1 ratio max
        if n_pos > 2 * n_neg and n_neg > 0:
            pos_indices = (self.labels == 1).nonzero(as_tuple=True)[0]
            neg_indices = (self.labels == 0).nonzero(as_tuple=True)[0]
            # Keep all negatives, subsample positives to 2x negatives
            keep_pos = pos_indices[torch.randperm(len(pos_indices))[:2 * n_neg]]
            keep_idx = torch.cat([keep_pos, neg_indices])
            keep_idx = keep_idx[torch.randperm(len(keep_idx))]  # shuffle
            self.user_features    = self.user_features[keep_idx]
            self.problem_features = self.problem_features[keep_idx]
            self.labels           = self.labels[keep_idx]
            print(f"  After rebalancing → {len(self.labels):,} samples")

        self.user_features    = torch.tensor(merged[skill_cols].values,             dtype=torch.float32)
        self.problem_features = torch.tensor(merged[topic_cols + num_prob_cols].values, dtype=torch.float32)
        self.labels = torch.tensor(
            (merged['rating'] == 1.0).astype(int).values,
            dtype=torch.float32
        )

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        return self.user_features[idx], self.problem_features[idx], self.labels[idx]
