"""
aux_models.py — Weak Area Detector + Content Projection Network
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class WeakAreaDetector(nn.Module):
    """
    Takes a user's skill vector + problem feature vector
    and predicts solve probability.

    High solve probability  → user is strong in this area → lower priority
    Low  solve probability  → user is weak in this area  → higher priority (recommend!)
    """

    def __init__(self, user_feat_dim: int, prob_feat_dim: int, hidden: int = 128, dropout: float = 0.3):
        super().__init__()

        self.user_encoder = nn.Sequential(
            nn.Linear(user_feat_dim, hidden),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden, 64)
        )

        self.prob_encoder = nn.Sequential(
            nn.Linear(prob_feat_dim, hidden),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden, 64)
        )

        # Merge and predict
        self.classifier = nn.Sequential(
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1)    # raw logit — loss handles sigmoid internally
        )

    def forward(self, user_feats: torch.Tensor, prob_feats: torch.Tensor) -> torch.Tensor:
        u = self.user_encoder(user_feats)   # (B, 64)
        p = self.prob_encoder(prob_feats)   # (B, 64)
        x = torch.cat([u, p], dim=1)        # (B, 128)

        logits = self.classifier(x).squeeze(1)  # (B,)

        return torch.clamp(logits, min=-10, max=10)  # (B,)

    def weakness_score(self, user_feats: torch.Tensor, prob_feats: torch.Tensor) -> torch.Tensor:
        """
        Returns a WEAKNESS score (1 - solve_probability).
        Higher = user is weaker at this problem type → should be recommended.
        """
        with torch.no_grad():
            logits     = self.forward(user_feats, prob_feats)
            solve_prob = torch.sigmoid(logits)
        return 1.0 - solve_prob


class ContentProjectionNet(nn.Module):
    """
    Projects raw sentence embeddings (384-dim) into a
    lower-dimensional space (128-dim) optimized for
    problem-problem similarity via triplet loss.
    """

    def __init__(self, input_dim: int = 384, proj_dim: int = 128, dropout: float = 0.2):
        super().__init__()

        self.projector = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(256, proj_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        proj = self.projector(x)
        return F.normalize(proj, p=2, dim=1)   # L2-normalize → cosine similarity = dot product

    def encode(self, x: torch.Tensor) -> torch.Tensor:
        """Alias for inference."""
        with torch.no_grad():
            return self.forward(x)


class HybridScorer(nn.Module):
    """
    Learnable weighted combination of all 3 recommendation signals.

    Inputs:
        cf_score    — collaborative filtering score       (B,)
        cb_score    — content-based similarity score      (B,)
        wa_score    — weak area / skill gap score         (B,)
        diff_score  — difficulty progression fit score    (B,)

    Output:
        final_score — scalar recommendation score         (B,)
    """

    def __init__(self):
        super().__init__()

        # Learnable weights (softmax-normalized so they sum to 1)
        self.raw_weights = nn.Parameter(torch.tensor([0.35, 0.25, 0.25, 0.15]))

    @property
    def weights(self):
        return F.softmax(self.raw_weights, dim=0)

    def forward(self,
                cf_score:   torch.Tensor,
                cb_score:   torch.Tensor,
                wa_score:   torch.Tensor,
                diff_score: torch.Tensor) -> torch.Tensor:

        w = self.weights
        scores = torch.stack([cf_score, cb_score, wa_score, diff_score], dim=1)  # (B, 4)
        return (scores * w).sum(dim=1)   # (B,)

    def print_weights(self):
        w = self.weights.detach().cpu().numpy()
        labels = ['Collaborative', 'Content-Based', 'Weak Area', 'Difficulty']
        print('\n📊 Hybrid Scorer Weights:')
        for l, v in zip(labels, w):
            bar = '█' * int(v * 40)
            print(f'  {l:<18} {bar} {v:.3f}')
