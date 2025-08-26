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
  PROFILES_STORE,
} from "./constants";
import { Ed25519KeyIdentity } from "@dfinity/identity";
import { Principal } from "@dfinity/principal";
import Loader from "../loader/Loader.tsx";
import { derivePrincipalAndIdentityFromSeed, generateSeedAndIdentityPrincipal } from "../crypto/encdcrpt";

// Interfaces for User Profile
export type UserProfile = {
  userID: string;
  seedPhrase: string;
  identity: Ed25519KeyIdentity;
  principal: Principal;
};

export type IdentityContextType = {
  currentProfile: UserProfile;
  createProfileFromSeed: (seed: string) => Promise<UserProfile>;
  switchProfile: (profile: UserProfile) => Promise<void>;
};

type indexDBProfile = {
  userID: string;
  seedPhrase: string;
}

const IdentityContext = createContext<IdentityContextType | undefined>(undefined);

export function IdentitySystemProvider({ children }: { children: ReactNode }) {
  const db = useRef<IDBDatabase | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<UserProfile>({} as any); // as any because there is no circumstances where currentProfile is used and could be possibly undefined

  useEffect(() => {
    const init = async () => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;

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
    const profile: indexDBProfile | undefined = await getUserProfile();
    if (profile && profile.seedPhrase && profile.userID) {
      const innerProfile = await createProfileFromSeed(profile.seedPhrase);
      setCurrentProfile(innerProfile);
    } else {
      const profile = await createProfileFromSeed();
      await saveProfile(profile);
      setCurrentProfile(profile);
    }
  };

  const getUserProfile = async () => {
    if (!db.current) throw new Error("DB not initialized");
    const tx = db.current.transaction(PROFILES_STORE, "readwrite");

    return new Promise<indexDBProfile | undefined>((resolve, reject) => {
      const req = tx.objectStore(PROFILES_STORE).getAll();
      req.onsuccess = () => {
        const indexedData = req.result[0];
        const userProfile: indexDBProfile = {
          userID: indexedData?.userID,
          seedPhrase: indexedData?.seedPhrase,
        }
        resolve(userProfile);
      }
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

  const saveProfile = useCallback(async (profile: UserProfile) => {
    if (!db.current) throw new Error("DB not initialized");
    await new Promise<void>((res, rej) => {
      const tx = db.current!.transaction(PROFILES_STORE, "readwrite");
      const store = tx.objectStore(PROFILES_STORE)
      const iProfile: indexDBProfile = {
        userID: profile.userID,
        seedPhrase: profile.seedPhrase
      }
      const req = store.put(iProfile);
      req.onerror = () => rej(req.error);
      tx.onabort = () => rej(tx.error ?? new Error("IDB tx aborted"));
      tx.onerror = () => rej(tx.error ?? new Error("IDB tx error"));
      tx.oncomplete = () => res();
    });
  }, []);

  const eraceCurrentProfile = useCallback(async () => {
    if (!db.current) throw new Error("DB not initialized");
    await new Promise<void>((res, rej) => {
      const tx = db.current!.transaction(PROFILES_STORE, "readwrite");
      const store = tx.objectStore(PROFILES_STORE);
      const req = store.clear();
      req.onerror = () => rej(req.error);
      tx.onabort = () => rej(tx.error ?? new Error("IDB identity tx aborted"));
      tx.onerror = () => rej(tx.error ?? new Error("IDB identity tx error"));
      tx.oncomplete = () => res();
    });
  }, []);

  // User Profile UI on Import SEED Phrase
  const switchProfile = useCallback(async (profile: UserProfile) => {
    await eraceCurrentProfile();
    await saveProfile(profile);
    setCurrentProfile(profile);
  }, [currentProfile]);

  const contextValue: IdentityContextType = {
    currentProfile,
    createProfileFromSeed,
    switchProfile,
  };

  if (!isReady) return <Loader />;
  return <IdentityContext.Provider value={contextValue}>{children}</IdentityContext.Provider>;
}

export function useIdentitySystem() {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error("useIdentitySystem must be inside provider");
  return ctx;
}
