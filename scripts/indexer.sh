#!/bin/bash

cd contracts

echo "----- Building World -----"
sozo build

echo "----- Migrating World -----"
sozo migrate apply

torii --world 0x70835f8344647b1e573fe7aeccbf044230089eb19624d3c7dea4080f5dcb025 --allowed-origins "*" --index-pending