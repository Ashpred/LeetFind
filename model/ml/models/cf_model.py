"""
cf_model.py — Collaborative Filtering Model (Matrix Factorization)
Architecture: User & Problem embeddings + biases + MLP head
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class MatrixFactorization(nn.Module):
    """
    Neural Matrix Factorization with:
    - Learnable user & problem embeddings
    - Per-user and per-problem bias terms
    - MLP head for non-linear interaction modeling
    - Dropout for regularization
    """

    def __init__(self, n_users: int, n_problems: int, n_factors: int = 64, dropout: float = 0.3):
        super().__init__()

        self.n_factors = n_factors

        # ── Embedding layers ──────────────────────────────────────────────────
        self.user_emb  = nn.Embedding(n_users,   n_factors)
        self.prob_emb  = nn.Embedding(n_problems, n_factors)

        # Bias terms (scalar per user/problem)
        self.user_bias = nn.Embedding(n_users,   1)
        self.prob_bias = nn.Embedding(n_problems, 1)

        # Global bias
        self.global_bias = nn.Parameter(torch.zeros(1))

        # ── MLP head (captures non-linear interactions) ───────────────────────
        self.mlp = nn.Sequential(
            nn.Linear(n_factors * 2, 128),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1)
        )

        # ── Weight initialization ─────────────────────────────────────────────
        nn.init.normal_(self.user_emb.weight,  mean=0, std=0.01)
        nn.init.normal_(self.prob_emb.weight,  mean=0, std=0.01)
        nn.init.zeros_(self.user_bias.weight)
        nn.init.zeros_(self.prob_bias.weight)

    def forward(self, user_idx: torch.Tensor, prob_idx: torch.Tensor) -> torch.Tensor:
        # Embeddings
        u = self.user_emb(user_idx)   # (B, n_factors)
        p = self.prob_emb(prob_idx)   # (B, n_factors)

        # Dot product (GMF branch)
        dot = (u * p).sum(dim=1, keepdim=True)   # (B, 1)

        # MLP branch — concatenate embeddings
        mlp_input  = torch.cat([u, p], dim=1)    # (B, n_factors*2)
        mlp_output = self.mlp(mlp_input)          # (B, 1)

        # Biases
        ub = self.user_bias(user_idx)  # (B, 1)
        pb = self.prob_bias(prob_idx)  # (B, 1)

        # Final score: GMF + MLP + biases
        score = dot + mlp_output + ub + pb + self.global_bias
        return score.squeeze(1)   # (B,)

    def get_user_embedding(self, user_idx: torch.Tensor) -> torch.Tensor:
        """Returns embedding for a user — used at inference."""
        return self.user_emb(user_idx)

    def get_problem_embedding(self, prob_idx: torch.Tensor) -> torch.Tensor:
        """Returns embedding for a problem — used at inference."""
        return self.prob_emb(prob_idx)


class EarlyStopping:
    """Stops training when validation loss stops improving."""

    def __init__(self, patience: int = 5, min_delta: float = 1e-4, path: str = 'saved_models/cf_best.pt'):
        self.patience   = patience
        self.min_delta  = min_delta
        self.path       = path
        self.counter    = 0
        self.best_loss  = float('inf')
        self.should_stop = False

    def __call__(self, val_loss: float, model: nn.Module):
        if val_loss < self.best_loss - self.min_delta:
            self.best_loss = val_loss
            self.counter   = 0
            torch.save(model.state_dict(), self.path)
            print(f'    ✅ Val loss improved → {val_loss:.6f} | checkpoint saved')
        else:
            self.counter += 1
            print(f'    ⏳ No improvement ({self.counter}/{self.patience})')
            if self.counter >= self.patience:
                self.should_stop = True
                print('    🛑 Early stopping triggered')
