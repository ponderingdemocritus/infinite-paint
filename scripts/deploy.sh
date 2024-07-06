#!/bin/bash

cd contracts

echo "Build contracts..."
sozo --profile prod build

echo "Deploying Colors"
slot deployments create color-2 katana --version v0.7.3 --disable-fee true --block-time 1000

echo "Migrating world..."
sozo --profile prod migrate apply

echo "Setting up remote indexer on slot..."
slot deployments create color-2 torii --version v0.7.3 --world 0xb4079627ebab1cd3cf9fd075dda1ad2454a7a448bf659591f259efa2519b18 --rpc https://api.cartridge.gg/x/color-2/katana --start-block 0  --index-pending true

echo "Setting up config..."
./scripts/default_auth.sh
