// Constants - Adjust these based on your needs
export const LOCAL_STORAGE_SEED_PHRASE = "LOCAL_STORAGE_SEED_PHRASE";
export const LOCAL_STORAGE_EVM_PUBLIC_ADDRESS =
  "LOCAL_STORAGE_EVM_PUBLIC_ADDRESS";

export const LOCAL_STORAGE_ICP_PUBLIC_ADDRESS =
  "LOCAL_STORAGE_ICP_PUBLIC_ADDRESS";

export const LOCAL_STORAGE_ORGANIZATION_VAULT_ID =
  "LOCAL_STORAGE_ORGANIZATION_VAULT_ID";

export const CONSTANTS = {
  LOCAL_STORAGE_SEED_PHRASE,
  LOCAL_STORAGE_EVM_PUBLIC_ADDRESS,
  LOCAL_STORAGE_ICP_PUBLIC_ADDRESS,
  LOCAL_STORAGE_ORGANIZATION_VAULT_ID,
};

export const DB_NAME = "Ghostkeys-identity";
export const DB_VERSION = 1;
export const VAULTS_STORE = "vaults";
export const PROFILES_STORE = "profiles";

export function shortenAddress(address: string): string {
  // if less than 10 chars, throw error
  if (address.length < 10) {
    return address;
  }
  const slug = `${address.slice(0, 3)}..${address.slice(-3)}`;
  return slug;
}

export const hexStringToUint8Array = (hexString: string): Uint8Array => {
  const result = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < hexString.length; i += 2) {
    result[i / 2] = parseInt(hexString.substr(i, 2), 16);
  }
  return result;
};