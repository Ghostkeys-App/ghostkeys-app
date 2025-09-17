#!/usr/bin/env bash
set -euo pipefail

# Allow override: export SHARED_VAULT_RELEASE_TAG=my-tag before running dfx build
TAG="${SHARED_VAULT_RELEASE_TAG:-shared-canister-dev-v0.6.1}"
BASE="https://github.com/Ghostkeys-App/vault-canister/releases/download/${TAG}"

WASM_DIR=".dfx/canisters"

SHARED_WASM="${WASM_DIR}/shared_vault_canister_backend/shared_vault_canister_backend.wasm"

SHARED_DID_PATH="${WASM_DIR}/shared_vault_canister_backend/shared-vault-canister-backend.did"

mkdir -p "${WASM_DIR}/shared_vault_canister_backend"

echo "[fetch] Downloading WASMs from release ${TAG}…"

curl -fsSL "${BASE}/shared_vault_canister_backend.wasm" -o "${SHARED_WASM}"

echo "[fetch] Downloading DIDs (if present in release)…"

SHARED_DID_OK=0
if curl -fsSL "${BASE}/shared-vault-canister-backend.did" -o "${SHARED_DID_PATH}"; then
  SHARED_DID_OK=1
fi

# Fallback: generate DID from wasm when not provided
if command -v candid-extractor >/dev/null 2>&1; then
  if [ "${SHARED_DID_OK}" -eq 0 ]; then
    echo "[fetch] Release did missing; extracting shared-vault DID from wasm…"
    candid-extractor "${SHARED_WASM}" > "${SHARED_DID_PATH}"
  fi
else
  if [ "${SHARED_DID_OK}" -eq 0 ]; then
    echo "error: candid-extractor not found and one or more DIDs not available in the release." >&2
    exit 1
  fi
fi

# sanity check
test -s "${SHARED_WASM}" && test -s "${SHARED_DID_PATH}"
echo "[fetch] OK."
