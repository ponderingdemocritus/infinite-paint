#!/bin/bash

cd contracts

echo "Build contracts..."
sozo --profile prod build

echo "Deploying Colors"
slot deployments create color-4 katana --version v1.0.0-alpha.3 --disable-fee true --block-time 1000

echo "Migrating world..."
sozo --profile prod migrate apply

echo "Setting up remote indexer on slot..."
slot deployments create color-4 torii --version v1.0.0-alpha.3 --world 0x177292c9085a51b0a5df818f11cbbb6cd18bf6e3c372219746bc8f92e8c83b5 --rpc https://api.cartridge.gg/x/color-4/katana --start-block 0  --index-pending true

echo "Setting up config..."
./scripts/default_auth.sh
