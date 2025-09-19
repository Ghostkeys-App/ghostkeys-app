#!/usr/bin/env bash
set -euo pipefail

# Allow override: export VAULT_RELEASE_TAG=my-tag before running dfx build
TAG="${VAULT_RELEASE_TAG:-shared-canister-dev-v0.6.4}"
BASE="https://github.com/Ghostkeys-App/vault-canister/releases/download/${TAG}"

WASM_DIR=".dfx/canisters"
VAULT_WASM="${WASM_DIR}/vault_canister_backend/vault_canister_backend.wasm"

VAULT_DID_PATH="${WASM_DIR}/vault_canister_backend/vault-canister-backend.did"

mkdir -p "${WASM_DIR}/vault_canister_backend"

echo "[fetch] Downloading WASMs from release ${TAG}…"
curl -fsSL "${BASE}/vault_canister_backend.wasm" -o "${VAULT_WASM}"

echo "[fetch] Downloading DIDs (if present in release)…"
VAULT_DID_OK=0
if curl -fsSL "${BASE}/vault-canister-backend.did" -o "${VAULT_DID_PATH}"; then
  VAULT_DID_OK=1
fi

# Fallback: generate DID from wasm when not provided
if command -v candid-extractor >/dev/null 2>&1; then
  if [ "${VAULT_DID_OK}" -eq 0 ]; then
    echo "[fetch] Release did missing; extracting vault DID from wasm…"
    candid-extractor "${VAULT_WASM}" > "${VAULT_DID_PATH}"
  fi
else
  if [ "${VAULT_DID_OK}" -eq 0 ]; then
    echo "error: candid-extractor not found and one or more DIDs not available in the release." >&2
    exit 1
  fi
fi

# sanity check
test -s "${VAULT_WASM}" && test -s "${VAULT_DID_PATH}"
echo "[fetch] OK."
