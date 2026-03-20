"""
train_cf.py — Collaborative Filtering Training Script
Optimized for RTX 5060 (sm_120) with CUDA 13.x
Run: python train_cf.py
"""

import os
import json
import pickle
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from tqdm import tqdm

# Local imports
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from models.cf_model import MatrixFactorization, EarlyStopping
from models.dataset  import InteractionDataset

# ── Config ─────────────────────────────────────────────────────────────────────
CONFIG = {
    'data_dir':        '../../data/processed',
    'save_dir':        '../../saved_models',
    'n_factors':       64,          # embedding dimension
    'dropout':         0.3,
    'lr':              1e-3,
    'weight_decay':    1e-5,        # L2 regularization
    'batch_size':      4096,        # large batch → better GPU utilization on RTX 5060
    'n_epochs':        50,
    'patience':        7,           # early stopping patience
    'num_workers':     4,           # parallel data loading
    'pin_memory':      True,        # faster CPU→GPU transfer
    'use_amp':         True,        # Automatic Mixed Precision (FP16) → faster on RTX 5060
}

os.makedirs(CONFIG['save_dir'], exist_ok=True)


def setup_device():
    """Detect and configure GPU."""
    if torch.cuda.is_available():
        device = torch.device('cuda')
        gpu    = torch.cuda.get_device_properties(0)
        print(f'🚀 GPU: {gpu.name}')
        print(f'   VRAM:      {gpu.total_memory / 1024**3:.1f} GB')
        print(f'   Compute:   sm_{gpu.major}{gpu.minor}')
        print(f'   cuDNN:     {torch.backends.cudnn.version()}')
        # Enable cuDNN auto-tuner — finds fastest conv algorithms for your GPU
        torch.backends.cudnn.benchmark = True
    else:
        device = torch.device('cpu')
        print('⚠️  CUDA not found — running on CPU (will be slow!)')
    return device


def load_data():
    """Load processed interaction splits and metadata."""
    print('\n📂 Loading data...')

    train_df = pd.read_csv(f"{CONFIG['data_dir']}/train.csv")
    val_df   = pd.read_csv(f"{CONFIG['data_dir']}/val.csv")
    test_df  = pd.read_csv(f"{CONFIG['data_dir']}/test.csv")

    with open(f"{CONFIG['data_dir']}/metadata.json") as f:
        meta = json.load(f)

    print(f'   Train: {len(train_df):,} | Val: {len(val_df):,} | Test: {len(test_df):,}')
    print(f'   Users: {meta["n_users"]:,} | Problems: {meta["n_problems"]:,}')
    return train_df, val_df, test_df, meta


def build_dataloaders(train_df, val_df, test_df):
    """Wrap DataFrames in Datasets and DataLoaders."""
    train_ds = InteractionDataset(train_df)
    val_ds   = InteractionDataset(val_df)
    test_ds  = InteractionDataset(test_df)

    loader_kwargs = dict(
        batch_size  = CONFIG['batch_size'],
        num_workers = CONFIG['num_workers'],
        pin_memory  = CONFIG['pin_memory'],
    )

    train_loader = DataLoader(train_ds, shuffle=True,  **loader_kwargs)
    val_loader   = DataLoader(val_ds,   shuffle=False, **loader_kwargs)
    test_loader  = DataLoader(test_ds,  shuffle=False, **loader_kwargs)

    return train_loader, val_loader, test_loader


def train_one_epoch(model, loader, optimizer, criterion, scaler, device):
    """Single training epoch with AMP support."""
    model.train()
    total_loss = 0.0

    for user_idx, prob_idx, ratings in loader:
        user_idx = user_idx.to(device, non_blocking=True)
        prob_idx = prob_idx.to(device, non_blocking=True)
        ratings  = ratings.to(device,  non_blocking=True)

        optimizer.zero_grad(set_to_none=True)

        # Automatic Mixed Precision forward pass
        with torch.amp.autocast('cuda', enabled=CONFIG['use_amp']):
            preds = model(user_idx, prob_idx)
            loss  = criterion(preds, ratings)

        scaler.scale(loss).backward()
        # Gradient clipping — prevents exploding gradients
        scaler.unscale_(optimizer)
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        scaler.step(optimizer)
        scaler.update()

        total_loss += loss.item() * len(ratings)

    return total_loss / len(loader.dataset)


@torch.no_grad()
def evaluate(model, loader, criterion, device):
    """Evaluate on val/test set. Returns MSE loss and RMSE."""
    model.eval()
    total_loss = 0.0
    all_preds  = []
    all_labels = []

    for user_idx, prob_idx, ratings in loader:
        user_idx = user_idx.to(device, non_blocking=True)
        prob_idx = prob_idx.to(device, non_blocking=True)
        ratings  = ratings.to(device,  non_blocking=True)

        with torch.amp.autocast('cuda', enabled=CONFIG['use_amp']):
            preds = model(user_idx, prob_idx)
            loss  = criterion(preds, ratings)

        total_loss += loss.item() * len(ratings)
        all_preds.extend(preds.cpu().numpy())
        all_labels.extend(ratings.cpu().numpy())

    avg_loss = total_loss / len(loader.dataset)
    rmse     = np.sqrt(np.mean((np.array(all_preds) - np.array(all_labels))**2))
    return avg_loss, rmse


def plot_training_curves(train_losses, val_losses, save_path):
    """Save training loss curves."""
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(train_losses, label='Train Loss', color='#6366f1', linewidth=2)
    ax.plot(val_losses,   label='Val Loss',   color='#f59e0b', linewidth=2)
    ax.set_xlabel('Epoch')
    ax.set_ylabel('MSE Loss')
    ax.set_title('Collaborative Filtering — Training Curves')
    ax.legend()
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(save_path, dpi=120)
    plt.close()
    print(f'📈 Training curves saved → {save_path}')


def main():
    print('=' * 60)
    print('  LeetCode Recommender — CF Model Training')
    print('=' * 60)

    device = setup_device()

    # ── Load data ─────────────────────────────────────────────────────────────
    train_df, val_df, test_df, meta = load_data()
    train_loader, val_loader, test_loader = build_dataloaders(train_df, val_df, test_df)

    # ── Build model ───────────────────────────────────────────────────────────
    model = MatrixFactorization(
        n_users    = meta['n_users'],
        n_problems = meta['n_problems'],
        n_factors  = CONFIG['n_factors'],
        dropout    = CONFIG['dropout']
    ).to(device)

    total_params = sum(p.numel() for p in model.parameters())
    print(f'\n🧠 Model parameters: {total_params:,}')

    # ── Optimizer & scheduler ─────────────────────────────────────────────────
    criterion = nn.MSELoss()
    optimizer = optim.AdamW(model.parameters(),
                            lr           = CONFIG['lr'],
                            weight_decay = CONFIG['weight_decay'])

    # Cosine annealing: gradually reduces LR → helps final convergence
    scheduler = optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=CONFIG['n_epochs'], eta_min=1e-5
    )

    # AMP scaler for FP16 training
    scaler = torch.amp.GradScaler('cuda', enabled=CONFIG['use_amp'])

    # Early stopping
    es = EarlyStopping(
        patience = CONFIG['patience'],
        path     = f"{CONFIG['save_dir']}/cf_best.pt"
    )

    # ── Training loop ─────────────────────────────────────────────────────────
    train_losses, val_losses = [], []
    print(f'\n🏋️  Training for up to {CONFIG["n_epochs"]} epochs...\n')

    for epoch in range(1, CONFIG['n_epochs'] + 1):
        train_loss         = train_one_epoch(model, train_loader, optimizer, criterion, scaler, device)
        val_loss, val_rmse = evaluate(model, val_loader, criterion, device)

        train_losses.append(train_loss)
        val_losses.append(val_loss)
        scheduler.step()

        current_lr = optimizer.param_groups[0]['lr']
        print(f'Epoch {epoch:03d}/{CONFIG["n_epochs"]} | '
              f'Train: {train_loss:.6f} | '
              f'Val: {val_loss:.6f} | '
              f'RMSE: {val_rmse:.4f} | '
              f'LR: {current_lr:.2e}')

        es(val_loss, model)
        if es.should_stop:
            print(f'\n🛑 Early stopping at epoch {epoch}')
            break

    # ── Final evaluation on test set ──────────────────────────────────────────
    print('\n📊 Loading best checkpoint for test evaluation...')
    model.load_state_dict(torch.load(f"{CONFIG['save_dir']}/cf_best.pt", weights_only=True))
    test_loss, test_rmse = evaluate(model, test_loader, criterion, device)
    print(f'✅ Test MSE: {test_loss:.6f} | Test RMSE: {test_rmse:.4f}')

    # ── Save everything ───────────────────────────────────────────────────────
    # Save full model + config for inference
    torch.save({
        'model_state_dict': model.state_dict(),
        'config':           CONFIG,
        'meta':             meta,
        'test_rmse':        float(test_rmse),
    }, f"{CONFIG['save_dir']}/cf_final.pt")

    # Save training curves
    plot_training_curves(
        train_losses, val_losses,
        save_path=f"{CONFIG['save_dir']}/cf_training_curves.png"
    )

    print(f'\n✅ All artifacts saved to {CONFIG["save_dir"]}/')
    print('   cf_best.pt              — best weights (early stopping)')
    print('   cf_final.pt             — full checkpoint + config')
    print('   cf_training_curves.png  — loss plot')
    print('\n➡️  Next: run python train_content.py')


if __name__ == '__main__':
    main()
