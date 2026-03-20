"""
train_content.py — Content-Based Projection Network Training
Uses triplet loss to fine-tune problem embeddings for better similarity
Run: python train_content.py
"""

import os, sys, json
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, random_split
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from models.aux_models import ContentProjectionNet
from models.dataset    import ContentDataset

CONFIG = {
    'data_dir':    '../../data/processed',
    'embed_dir':   '../../data/embeddings',
    'save_dir':    '../../saved_models',
    'proj_dim':    128,
    'dropout':     0.2,
    'lr':          5e-4,
    'batch_size':  1024,
    'n_epochs':    30,
    'n_triplets':  40000,
    'margin':      0.3,       # triplet loss margin
    'num_workers': 4,
    'use_amp':     True,
}

os.makedirs(CONFIG['save_dir'], exist_ok=True)


def main():
    print('=' * 60)
    print('  LeetCode Recommender — Content Projection Training')
    print('=' * 60)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f'🚀 Device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"}')

    # ── Load data ─────────────────────────────────────────────────────────────
    print('\n📂 Loading embeddings & problem metadata...')
    embeddings  = np.load(f"{CONFIG['embed_dir']}/problem_embeddings.npy")
    problems_df = pd.read_csv(f"{CONFIG['data_dir']}/../raw/problems.csv")

    # Parse topics back to list (saved as string in CSV)
    import ast
    problems_df['topics'] = problems_df['topics'].apply(
        lambda x: ast.literal_eval(x) if isinstance(x, str) else []
    )

    input_dim = embeddings.shape[1]
    print(f'   Embeddings: {embeddings.shape}')

    # ── Build dataset ─────────────────────────────────────────────────────────
    print(f'\n⏳ Building {CONFIG["n_triplets"]:,} triplets (takes ~30s)...')
    full_ds = ContentDataset(embeddings, problems_df, n_triplets=CONFIG['n_triplets'])

    # 90/10 split
    train_size = int(0.8 * len(full_ds))
    val_size   = len(full_ds) - train_size
    train_ds, val_ds = random_split(full_ds, [train_size, val_size])

    train_loader = DataLoader(train_ds, batch_size=CONFIG['batch_size'],
                              shuffle=True,  num_workers=CONFIG['num_workers'], pin_memory=True)
    val_loader   = DataLoader(val_ds,   batch_size=CONFIG['batch_size'],
                              shuffle=False, num_workers=CONFIG['num_workers'], pin_memory=True)

    # ── Model ─────────────────────────────────────────────────────────────────
    model = ContentProjectionNet(
        input_dim = input_dim,
        proj_dim  = CONFIG['proj_dim'],
        dropout   = CONFIG['dropout']
    ).to(device)
    print(f'🧠 Model parameters: {sum(p.numel() for p in model.parameters()):,}')

    triplet_loss = nn.TripletMarginLoss(margin=CONFIG['margin'], p=2)
    optimizer    = optim.AdamW(model.parameters(), lr=CONFIG['lr'])
    scheduler    = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=CONFIG['n_epochs'])
    scaler       = torch.amp.GradScaler('cuda', enabled=CONFIG['use_amp'])

    best_val, train_losses, val_losses = float('inf'), [], []

    print(f'\n🏋️  Training for {CONFIG["n_epochs"]} epochs...\n')

    for epoch in range(1, CONFIG['n_epochs'] + 1):
        # Train
        model.train()
        train_loss = 0.0
        for anchor, positive, negative in train_loader:
            anchor   = anchor.to(device,   non_blocking=True)
            positive = positive.to(device, non_blocking=True)
            negative = negative.to(device, non_blocking=True)

            optimizer.zero_grad(set_to_none=True)
            with torch.amp.autocast('cuda', enabled=CONFIG['use_amp']):
                loss = triplet_loss(model(anchor), model(positive), model(negative))
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            train_loss += loss.item()

        # Validate
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for anchor, positive, negative in val_loader:
                anchor   = anchor.to(device,   non_blocking=True)
                positive = positive.to(device, non_blocking=True)
                negative = negative.to(device, non_blocking=True)
                with torch.amp.autocast('cuda', enabled=CONFIG['use_amp']):
                    val_loss += triplet_loss(model(anchor), model(positive), model(negative)).item()

        t_loss = train_loss / len(train_loader)
        v_loss = val_loss   / len(val_loader)
        train_losses.append(t_loss)
        val_losses.append(v_loss)
        scheduler.step()

        print(f'Epoch {epoch:03d}/{CONFIG["n_epochs"]} | Train: {t_loss:.4f} | Val: {v_loss:.4f}')

        if v_loss < best_val:
            best_val = v_loss
            torch.save(model.state_dict(), f"{CONFIG['save_dir']}/content_best.pt")
            print(f'  ✅ Saved best checkpoint (val={best_val:.4f})')

    # Precompute & save projected embeddings for fast inference
    print('\n⏳ Projecting all problem embeddings...')
    model.load_state_dict(torch.load(f"{CONFIG['save_dir']}/content_best.pt", weights_only=True))
    model.eval()
    all_emb_t    = torch.tensor(embeddings, dtype=torch.float32)
    proj_batches = []
    with torch.no_grad():
        for i in range(0, len(all_emb_t), 512):
            batch = all_emb_t[i:i+512].to(device)
            proj_batches.append(model.encode(batch).cpu().numpy())
    projected = np.vstack(proj_batches)
    np.save(f"{CONFIG['embed_dir']}/projected_embeddings.npy", projected)

    print(f'✅ Projected embeddings saved: {projected.shape}')
    print(f'✅ Content model saved → {CONFIG["save_dir"]}/content_best.pt')
    print('\n➡️  Next: run python train_weak_area.py')


if __name__ == '__main__':
    main()
