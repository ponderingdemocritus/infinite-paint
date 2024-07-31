#!/bin/bash

cd contracts

echo "Build contracts..."
sozo --profile prod build

echo "Deploying Colors"
slot deployments create color-4 katana --version v1.0.0-alpha.3 --disable-fee true --block-time 1000

echo "Migrating world..."
sozo --profile prod migrate apply

echo "Setting up remote indexer on slot..."
slot deployments create color-4 torii --version v1.0.0-alpha.3 --world 0x70835f8344647b1e573fe7aeccbf044230089eb19624d3c7dea4080f5dcb025 --rpc https://api.cartridge.gg/x/color-4/katana --start-block 0  --index-pending true

echo "Setting up config..."
./scripts/default_auth.sh
