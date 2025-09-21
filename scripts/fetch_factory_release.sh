#!/usr/bin/env bash
set -euo pipefail

# Allow override: export FACTORY_RELEASE_TAG=my-tag before running dfx build
TAG="${FACTORY_RELEASE_TAG:-factory-canister-dev-v0.9.4}"
BASE="https://github.com/Ghostkeys-App/factory-canister/releases/download/${TAG}"

WASM_DIR=".dfx/canisters/factory_canister_backend"
FAC_WASM="${WASM_DIR}/factory_canister_backend.wasm"

FAC_DID_PATH="${WASM_DIR}/factory-canister-backend.did"

mkdir -p "${WASM_DIR}"

echo "[fetch] Downloading WASMs from release ${TAG}…"
curl -fsSL "${BASE}/factory_canister_backend.wasm" -o "${FAC_WASM}"

echo "[fetch] Downloading DIDs (if present in release)… ${BASE}/factory-canister-backend.did to ${FAC_DID_PATH}"
FAC_DID_OK=0
if curl -fsSL "${BASE}/factory-canister-backend.did" -o "${FAC_DID_PATH}"; then
  FAC_DID_OK=1
fi

# Fallback: generate DID from wasm when not provided
if command -v candid-extractor >/dev/null 2>&1; then
  if [ "${FAC_DID_OK}" -eq 0 ]; then
    echo "[fetch] Release did missing; extracting factory DID from wasm…"
    candid-extractor "${FAC_WASM}" > "${FAC_DID_PATH}"
  fi
else
  if [ "${FAC_DID_OK}" -eq 0 ]; then
    echo "error: candid-extractor not found and one or more DIDs not available in the release." >&2
    exit 1
  fi
fi

test -s "${FAC_WASM}" && test -s "${FAC_DID_PATH}"
echo "[fetch] OK."
