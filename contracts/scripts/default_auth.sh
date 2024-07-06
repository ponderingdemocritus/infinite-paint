#!/bin/bash
set -euo pipefail
pushd $(dirname "$0")/..

need_cmd() {
  if ! check_cmd "$1"; then
    printf "need '$1' (command not found)"
    exit 1
  fi
}

check_cmd() {
  command -v "$1" &>/dev/null
}

need_cmd jq

export WORLD_ADDRESS=$(cat ./manifests/prod/manifest.json | jq -r '.world.address')

echo "---------------------------------------------------------------------------"
echo world : $WORLD_ADDRESS
echo "---------------------------------------------------------------------------"

# enable system -> models authorizations
sozo --profile prod auth grant --world $WORLD_ADDRESS --wait writer \
  Tile,dojo_starter::systems::actions::actions\
  Player,dojo_starter::systems::actions::actions\
  >/dev/null

echo "Default authorizations have been successfully set."