#!/bin/bash

cd contracts

echo "Build contracts..."
sozo --profile prod build

echo "Deploying Colors"
slot deployments create color katana --version v0.7.3 --disable-fee true --block-time 1000

echo "Migrating world..."
sozo --profile prod migrate apply

echo "Setting up remote indexer on slot..."
slot deployments create eternum-23 torii --version v0.7.2 --world 0x161b08e252b353008665e85ab5dcb0044a61186eb14b999657d14c04c94c824 --rpc https://api.cartridge.gg/x/eternum-23/katana --start-block 0  --index-pending true

bun --env-file=../client/.env.production ../config/index.ts

echo "Setting up config..."
./scripts/set_writer.sh --interval 1  --mode prod 

echo "Setting up bank..."
bun --env-file=../client/.env.production ../config/bank/index.ts