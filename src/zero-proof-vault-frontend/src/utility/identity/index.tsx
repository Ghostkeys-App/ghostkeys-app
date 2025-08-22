import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useContext,
  ReactNode,
  useRef,
} from "react";
import {
  DB_NAME,
  DB_VERSION,
  LOCAL_STORAGE_ICP_PUBLIC_ADDRESS,
  LOCAL_STORAGE_ORGANIZATION_VAULT_ID,
  LOCAL_STORAGE_SEED_PHRASE,
  PROFILES_STORE,
  shortenAddress,
  VAULTS_STORE,
} from "./constants";
import { Ed25519KeyIdentity } from "@dfinity/identity";
import { Principal } from "@dfinity/principal";
import { mnemonicToSeedSync } from "@scure/bip39";
import LoadingAnimation from "../../components/NotFound/LoadingAnimation";
import { derivePrincipalAndIdentityFromSeed, generateSeedAndIdentityPrincipal } from "../crypto/encdcrpt";

// Interfaces for Vault and User Profile
export type Vault = {
  vaultID: string;
  nickname: string;
  icpPublicAddress: string;
  endpoint: string;
};

export type UserProfile = {
  userID: string;
  seedPhrase: string;
  identity: Ed25519KeyIdentity;
  principal: Principal;
};

export type IdentityContextType = {
  currentVault: Vault | null;
  currentProfile: UserProfile | null;
  createVault: (nickname: string) => Promise<Vault>;
  switchVault: (vault: Vault) => void;
  renameVault: (vaultID: string, newName: string) => Vault | undefined;
  listVaults: () => Promise<Vault[]>;
  createProfileFromSeed: (seed: string) => Promise<UserProfile>;
  switchProfile: (profile: UserProfile) => Promise<void>;
};

const IdentityContext = createContext<IdentityContextType | undefined>(undefined);

export function IdentitySystemProvider({ children }: { children: ReactNode }) {
  const db = useRef<IDBDatabase | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentVault, setCurrentVault] = useState<Vault | null>(null);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const init = async () => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(VAULTS_STORE)) {
          db.createObjectStore(VAULTS_STORE, { keyPath: "vaultID" });
        }
        if (!db.objectStoreNames.contains(PROFILES_STORE)) {
          db.createObjectStore(PROFILES_STORE, { keyPath: "userID" });
        }
      };

      request.onsuccess = async (e) => {
        db.current = (e.target as IDBOpenDBRequest).result;
        await bootstrap();
        setIsReady(true);
      };
    };

    init();
  }, []);

  const bootstrap = async () => {
    const seed: string | undefined = await getSeedPhrase();

    if (seed) {
      const profile = await createProfileFromSeed(seed);
      setCurrentProfile(profile);
    } else {
      const profile = await createProfileFromSeed();
      await saveProfile(profile);
      setCurrentProfile(profile);
    }
  };

  const getSeedPhrase = async () => {
    if (!db.current) throw new Error("DB not initialized");
    const tx = db.current.transaction(PROFILES_STORE, "readwrite");

    return new Promise<string | undefined>((resolve, reject) => {
      const req = tx.objectStore(PROFILES_STORE).getAll();
      req.onsuccess = () => resolve(req.result?.[0]?.seedPhrase);
      req.onerror = () => reject(req.error);
    });
  }


  const createProfileFromSeed = useCallback(async (existingSeed?: string): Promise<UserProfile> => {
    let seed, principal, identity;
    if (existingSeed) {
      ({ principal, identity } = await derivePrincipalAndIdentityFromSeed(existingSeed));
      seed = existingSeed;
    } else {
      ({ seed, principal, identity } = await generateSeedAndIdentityPrincipal());
    }

    return {
      userID: `UserID_${principal.toString()}`,
      principal: principal,
      identity: identity,
      seedPhrase: seed,
    };
  }, []);

  const saveProfile = async (profile: UserProfile) => {
    if (!db.current) throw new Error("DB not initialized");
    const tx = db.current.transaction(PROFILES_STORE, "readwrite");
    tx.objectStore(PROFILES_STORE).put(profile);
  };

  const switchProfile = async (profile: UserProfile) => {
    setCurrentProfile(profile);
  };

  const createVault = async (nickname: string): Promise<Vault> => {
    if (!currentProfile) throw new Error("No profile set");

    const { principal } = await generateSeedAndIdentityPrincipal();
    const vaultID = `Vault_${principal.toString()}`;
    const newVault: Vault = {
      vaultID,
      nickname,
      icpPublicAddress: principal.toString(),
      endpoint: "",
    };
    if (!db.current) throw new Error("DB not initialized");
    const tx = db.current.transaction(VAULTS_STORE, "readwrite");
    tx.objectStore(VAULTS_STORE).put(newVault);
    return newVault;
  };

  const renameVault = (vaultID: string, newName: string) => {
    if (!db.current) throw new Error("DB not initialized");
    if (!currentProfile) throw new Error("No profile set");
    const tx = db.current.transaction(VAULTS_STORE, "readwrite");
    const store = tx.objectStore(VAULTS_STORE);
    const vault = store.get(vaultID) as unknown as Vault | undefined;
    if (vault) {
      vault.nickname = newName;
      store.put(vault);
    }
    return vault;
  }

  const switchVault = (vault: Vault) => {
    setCurrentVault(vault);
  };

  const listVaults = async (): Promise<Vault[]> => {
    if (!db.current) throw new Error("DB not initialized");
    const tx = db.current.transaction(VAULTS_STORE, "readonly");
    const req = tx.objectStore(VAULTS_STORE).getAll();
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as Vault[]);
      req.onerror = () => reject("Failed to list vaults");
    });
  };

  const contextValue: IdentityContextType = {
    currentVault,
    currentProfile,
    createVault,
    switchVault,
    renameVault,
    listVaults,
    createProfileFromSeed,
    switchProfile,
  };

  if (!isReady) return <LoadingAnimation />;
  return <IdentityContext.Provider value={contextValue}>{children}</IdentityContext.Provider>;
}

export function useIdentitySystem() {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error("useIdentitySystem must be inside provider");
  return ctx;
}
