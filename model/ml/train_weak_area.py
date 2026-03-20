"""
train_weak_area.py — Weak Area Detector Training
Run: python train_weak_area.py
"""

import os, sys, json
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
import pandas as pd
import numpy as np

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from models.aux_models import WeakAreaDetector
from models.dataset    import UserProblemFeatureDataset

CONFIG = {
    'data_dir':    '../../data/processed',
    'save_dir':    '../../saved_models',
    'hidden':      128,
    'dropout':     0.3,
    'lr':          3e-4,
    'batch_size':  2048,
    'n_epochs':    25,
    'num_workers': 4,
    'use_amp':     True,
}

os.makedirs(CONFIG['save_dir'], exist_ok=True)


def main():

    interactions_df     = pd.read_csv(f"{CONFIG['data_dir']}/../raw/interactions.csv")
    user_features_df    = pd.read_csv(f"{CONFIG['data_dir']}/user_features.csv")
    problem_features_df = pd.read_csv(f"{CONFIG['data_dir']}/problem_features.csv")
    
    labels = (interactions_df['rating'] == 1.0).astype(int)
    print(f"Raw label distribution:")
    print(f"  Positive (rating=1.0): {(labels==1).sum():,}")
    print(f"  Negative (rating<1.0): {(labels==0).sum():,}")
    print(f"  Total:                 {len(labels):,}")
    print(f"  Positive rate:         {labels.mean():.3%}")

    print('=' * 60)
    print('  LeetCode Recommender — Weak Area Detector Training')
    print('=' * 60)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f'🚀 Device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"}')

    # ── Load data ─────────────────────────────────────────────────────────────
    print('\n📂 Loading features...')
    interactions_df     = pd.read_csv(f"{CONFIG['data_dir']}/../raw/interactions.csv")
    user_features_df    = pd.read_csv(f"{CONFIG['data_dir']}/user_features.csv")
    problem_features_df = pd.read_csv(f"{CONFIG['data_dir']}/problem_features.csv")

    dataset = UserProblemFeatureDataset(interactions_df, user_features_df, problem_features_df)

    # 80/20 split
    train_size = int(0.8 * len(dataset))
    val_size   = len(dataset) - train_size
    train_ds, val_ds = torch.utils.data.random_split(dataset, [train_size, val_size])

    train_loader = DataLoader(train_ds, batch_size=CONFIG['batch_size'],
                              shuffle=True,  num_workers=CONFIG['num_workers'], pin_memory=True)
    val_loader   = DataLoader(val_ds,   batch_size=CONFIG['batch_size'],
                              shuffle=False, num_workers=CONFIG['num_workers'], pin_memory=True)

    # Infer feature dims from dataset
    sample_u, sample_p, _ = dataset[0]
    user_feat_dim = sample_u.shape[0]
    prob_feat_dim = sample_p.shape[0]
    print(f'   User feat dim:    {user_feat_dim}')
    print(f'   Problem feat dim: {prob_feat_dim}')
    print(f'   Train: {train_size:,} | Val: {val_size:,}')

    # ── Model ─────────────────────────────────────────────────────────────────
    model = WeakAreaDetector(
        user_feat_dim = user_feat_dim,
        prob_feat_dim = prob_feat_dim,
        hidden        = CONFIG['hidden'],
        dropout       = CONFIG['dropout']
    ).to(device)

    # BCELoss: predicts solve probability (binary classification)
    pos_weight = torch.tensor([2.0], device=device)
    criterion  = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    optimizer = optim.AdamW(model.parameters(), lr=CONFIG['lr'])
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=8, gamma=0.5)
    scaler    = torch.amp.GradScaler('cuda', enabled=CONFIG['use_amp'])

    best_val = float('inf')
    print(f'\n🏋️  Training for {CONFIG["n_epochs"]} epochs...\n')

    for epoch in range(1, CONFIG['n_epochs'] + 1):
        # Train
        model.train()
        train_loss = 0.0
        correct, total = 0, 0

        for u_feats, p_feats, labels in train_loader:
            u_feats = u_feats.to(device, non_blocking=True)
            p_feats = p_feats.to(device, non_blocking=True)
            labels  = labels.to(device,  non_blocking=True)

            optimizer.zero_grad(set_to_none=True)
            with torch.amp.autocast('cuda', enabled=CONFIG['use_amp']):
                preds = model(u_feats, p_feats)
                loss  = criterion(preds, labels)

            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=0.5)
            scaler.step(optimizer)
            scaler.update()

            train_loss += loss.item()
            correct += ((torch.sigmoid(preds) > 0.5) == labels.bool()).sum().item()
            total      += len(labels)

        # Validate
        model.eval()
        val_loss, val_correct, val_total = 0.0, 0, 0
        with torch.no_grad():
            for u_feats, p_feats, labels in val_loader:
                u_feats = u_feats.to(device, non_blocking=True)
                p_feats = p_feats.to(device, non_blocking=True)
                labels  = labels.to(device,  non_blocking=True)
                with torch.amp.autocast('cuda', enabled=CONFIG['use_amp']):
                    preds    = model(u_feats, p_feats)
                    val_loss += criterion(preds, labels).item()
                val_correct += ((torch.sigmoid(preds) > 0.5) == labels.bool()).sum().item()
                val_total   += len(labels)

        t_loss = train_loss / len(train_loader)
        v_loss = val_loss   / len(val_loader)
        t_acc  = correct    / total
        v_acc  = val_correct / val_total
        scheduler.step()

        print(f'Epoch {epoch:02d}/{CONFIG["n_epochs"]} | '
              f'Train Loss: {t_loss:.4f} Acc: {t_acc:.3f} | '
              f'Val Loss: {v_loss:.4f} Acc: {v_acc:.3f}')

        if v_loss < best_val:
            best_val = v_loss
            torch.save(model.state_dict(), f"{CONFIG['save_dir']}/weak_area_best.pt")
            print(f'  ✅ Saved (val_loss={best_val:.4f})')

    print(f'\n✅ Weak area detector saved → {CONFIG["save_dir"]}/weak_area_best.pt')
    print('➡️  Next: run python evaluate.py')


if __name__ == '__main__':
    main()
