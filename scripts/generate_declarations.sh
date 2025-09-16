#!/bin/bash

# Ensure junobuild-didc is installed before continuing.
echo "[generate] Checking junobuild-didc requirement..."
if ! command -v junobuild-didc > /dev/null 2>&1; then
    echo "junobuild-didc could not be found; installing..."
    cargo install junobuild-didc
fi
if ! command -v junobuild-didc > /dev/null 2>&1; then
    exit "ERROR: junobuild-didc could not be found or installed."
fi
echo "[generate] junobuild-didc OK."

DID_ROOT=".dfx/canisters"
GEN_TARGET_DIR="src/declarations"

SHARED_VAULT_DID="${DID_ROOT}/shared_vault_canister_backend/shared-vault-canister-backend.did"
SHARED_VAULT_DECLARATIONS="${GEN_TARGET_DIR}/shared-vault-canister-backend/shared-vault-canister-backend"

VAULT_DID="${DID_ROOT}/vault_canister_backend/vault-canister-backend.did"
VAULT_DECLARATIONS="${GEN_TARGET_DIR}/vault-canister-backend/vault-canister-backend"

FACTORY_DID="${DID_ROOT}/factory_canister_backend/factory-canister-backend.did"
FACTORY_DECLARATIONS="${GEN_TARGET_DIR}/factory-canister-backend/factory-canister-backend"

# Clean out existing declarations (excluding indexes under source control)
echo "[generate] Clean existing declarations"
rm -rf "${GEN_TARGET_DIR}/**/*.did*"

# First copy the candids to the declarations folder
echo "[generate] Generating candids (did)"
junobuild-didc -i "${SHARED_VAULT_DID}" -t did -o "${SHARED_VAULT_DECLARATIONS}.did"
junobuild-didc -i "${VAULT_DID}" -t did -o "${VAULT_DECLARATIONS}.did"
junobuild-didc -i "${FACTORY_DID}" -t did -o "${FACTORY_DECLARATIONS}.did"
test -s "${SHARED_VAULT_DECLARATIONS}.did" && test -s "${VAULT_DECLARATIONS}.did" && test -s "${FACTORY_DECLARATIONS}.did"
echo "[generate] Candids OK."

# Generate types
echo "[generate] Generating types (ts)"
junobuild-didc -i "${SHARED_VAULT_DID}" -t ts -o "${SHARED_VAULT_DECLARATIONS}.did.d.ts"
junobuild-didc -i "${VAULT_DID}" -t ts -o "${VAULT_DECLARATIONS}.did.d.ts"
junobuild-didc -i "${FACTORY_DID}" -t ts -o "${FACTORY_DECLARATIONS}.did.d.ts"
test -s "${SHARED_VAULT_DECLARATIONS}.did.ts" && test -s "${VAULT_DECLARATIONS}.did.ts" && test -s "${FACTORY_DECLARATIONS}.did.ts"
echo "[generate] Types OK."

# Generate declarations
echo "[generate] Generating idlFactory (js)"
junobuild-didc -i "${SHARED_VAULT_DID}" -t js -o "${SHARED_VAULT_DECLARATIONS}.did.js"
junobuild-didc -i "${VAULT_DID}" -t js -o "${VAULT_DECLARATIONS}.did.js"
junobuild-didc -i "${FACTORY_DID}" -t js -o "${FACTORY_DECLARATIONS}.did.js"
test -s "${SHARED_VAULT_DECLARATIONS}.did.js" && test -s "${VAULT_DECLARATIONS}.did.js" && test -s "${FACTORY_DECLARATIONS}.did.js"
echo "[generate] idlFactory OK."

echo "[generate] OK."