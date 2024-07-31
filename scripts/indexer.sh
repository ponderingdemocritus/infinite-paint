#!/bin/bash

cd contracts

echo "----- Building World -----"
sozo build

echo "----- Migrating World -----"
sozo migrate apply

torii --world 0x177292c9085a51b0a5df818f11cbbb6cd18bf6e3c372219746bc8f92e8c83b5 --allowed-origins "*" --index-pending