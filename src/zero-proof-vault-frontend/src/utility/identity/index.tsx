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
  commited: boolean;
};

// WARNING: do not call switch profile for profiles that don't exists on the server
export type IdentityContextType = {
  currentProfile: UserProfile;
  profiles: indexDBProfile[];
  createProfileFromSeed: (seed: string) => Promise<UserProfile>;
  switchProfile: (profile: UserProfile) => Promise<void>;
  setActiveProfileById: (userID: string) => Promise<void>;
  addProfileFromSeed: (seed: string) => Promise<UserProfile>;
  eraceIdentities: () => Promise<void>;
  markProfileCommited: (profile: UserProfile) => Promise<void>;
  removeProfile: (userID: string) => Promise<void>;
  addEmptyProfile: () => Promise<void>;
};

export type indexDBProfile = {
  userID: string;
  seedPhrase: string;
  active: boolean;
  commited: boolean; // exists on server
}

const IdentityContext = createContext<IdentityContextType | undefined>(undefined);

export function IdentitySystemProvider({ children }: { children: ReactNode }) {
  const db = useRef<IDBDatabase | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<UserProfile>({} as any); // as any because there is no circumstances where currentProfile is used and could be possibly undefined
  const [profiles, setProfiles] = useState<indexDBProfile[]>([]);

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
      commited: false
    };
  }, []);

  const getAllProfiles = useCallback(async () => {
    if (!db.current) throw new Error("DB not initialized");
    const tx = db.current.transaction(PROFILES_STORE, "readwrite");

    return new Promise<indexDBProfile[]>((resolve, reject) => {
      const req = tx.objectStore(PROFILES_STORE).getAll();
      req.onsuccess = () => {
        const rows: indexDBProfile[] = (req.result || []).map((r: any) => ({
          userID: r?.userID,
          seedPhrase: r?.seedPhrase,
          active: !!r?.active,
          commited: r?.commited
        }));
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  }, []);

  const upsertProfile = useCallback(async (profile: indexDBProfile) => {
    if (!db.current) throw new Error("DB not initialized");
    await new Promise<void>((res, rej) => {
      const tx = db.current!.transaction(PROFILES_STORE, "readwrite");
      const store = tx.objectStore(PROFILES_STORE);
      const req = store.put(profile);
      req.onerror = () => rej(req.error);
      tx.onabort = () => rej(tx.error ?? new Error("IDB tx aborted"));
      tx.onerror = () => rej(tx.error ?? new Error("IDB tx error"));
      tx.oncomplete = () => res();
    });
    // await new Promise<void>((res, rej) => {
    //   const tx = db.current!.transaction(PROFILES_STORE, "readwrite");
    //   const store = tx.objectStore(PROFILES_STORE);
    //   const req = store.put({ userID: currentProfile.userID, seedPhrase: currentProfile.seedPhrase, active: false });
    //   req.onerror = () => rej(req.error);
    //   tx.onabort = () => rej(tx.error ?? new Error("IDB tx aborted"));
    //   tx.onerror = () => rej(tx.error ?? new Error("IDB tx error"));
    //   tx.oncomplete = () => res();
    // });
  }, []);

  const bootstrap = useCallback(async () => {
    const all = await getAllProfiles();
    if (all && all.length > 0) {
      setProfiles(all);
      const active = all.find((p) => p.active) ?? all[0];
      if (active && active.seedPhrase) {
        const innerProfile = await createProfileFromSeed(active.seedPhrase);
        innerProfile.commited = active.commited;
        setCurrentProfile(innerProfile);
      }
    } else {
      const profile = await createProfileFromSeed();
      const idbLikeProfile = { userID: profile.userID, seedPhrase: profile.seedPhrase, active: true, commited: false };
      await upsertProfile(idbLikeProfile);
      setProfiles([idbLikeProfile]);
      setCurrentProfile(profile);
    }
  }, [createProfileFromSeed, getAllProfiles, upsertProfile]);

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
  }, [bootstrap]);

  const setActiveProfileById = useCallback(async (userID: string) => {
    if (!db.current) throw new Error("DB not initialized");
    await new Promise<void>((res, rej) => {
      const tx = db.current!.transaction(PROFILES_STORE, "readwrite");
      const store = tx.objectStore(PROFILES_STORE);
      const getAllReq = store.getAll();
      getAllReq.onerror = () => rej(getAllReq.error);
      getAllReq.onsuccess = () => {
        const rows = getAllReq.result as indexDBProfile[];
        for (const row of rows) {
          const next: indexDBProfile = { ...row, active: row.userID === userID };
          store.put(next);
        }
      };
      tx.onabort = () => rej(tx.error ?? new Error("IDB identity tx aborted"));
      tx.onerror = () => rej(tx.error ?? new Error("IDB identity tx error"));
      tx.oncomplete = () => res();
    });
    const nextProfiles = await getAllProfiles();
    setProfiles(nextProfiles);
  }, []);

  const dropPersistanceStorageForAllProfiles = useCallback(async () => {
    if (!currentProfile) throw new Error("No profile set");
    if (!db.current) throw new Error("DB not initialized");

    await new Promise<void>((res, rej) => {
      const tx = db.current!.transaction(PROFILES_STORE, "readwrite");
      const store = tx.objectStore(PROFILES_STORE);
      const req = store.clear();

      req.onerror = () => rej(req.error);
      tx.onabort = () => rej(tx.error ?? new Error("IDB tx aborted"));
      tx.onerror = () => rej(tx.error ?? new Error("IDB tx error"));
      tx.oncomplete = () => res();
    });
  }, [])

  const switchProfile = useCallback(async (profile: UserProfile) => {
    try {
      // at this point profile definitelly exists on server
      await upsertProfile({ userID: profile.userID, seedPhrase: profile.seedPhrase, active: true, commited: true });
      await setActiveProfileById(profile.userID);
    } catch (e) {
      console.log("Error on switch profile: ", e);
    }
    profile.commited = true;
    setCurrentProfile(profile);
  }, [setActiveProfileById]);

  const addProfileFromSeed = useCallback(async (seed: string): Promise<UserProfile> => {
    const prof = await createProfileFromSeed(seed);
    await switchProfile(prof);
    return prof;
  }, [createProfileFromSeed, switchProfile]);

  const eraceIdentities = useCallback(async (): Promise<void> => {
    await dropPersistanceStorageForAllProfiles();
    // maybe add more logic later, don't know
  }, []);

  const markProfileCommited = useCallback(async (profile: UserProfile): Promise<void> => {
    await upsertProfile({ userID: profile.userID, seedPhrase: profile.seedPhrase, active: true, commited: true });
    setProfiles(p => p.map(pr => pr.seedPhrase == profile.seedPhrase ? { ...pr, commited: profile.commited } : pr));
    setCurrentProfile({ ...profile, commited: true });
  }, [currentProfile, profiles]);

  const removeProfile = useCallback(async (userID: string): Promise<void> => {
    if (!db.current) throw new Error("DB not initialized");

    const removedWasCurrent = currentProfile?.userID === userID;

    await new Promise<void>((res, rej) => {
      const tx = db.current!.transaction(PROFILES_STORE, "readwrite");
      const store = tx.objectStore(PROFILES_STORE);
      const req = store.delete(userID);
      req.onerror = () => rej(req.error);
      tx.onabort = () => rej(tx.error ?? new Error("IDB tx aborted"));
      tx.onerror = () => rej(tx.error ?? new Error("IDB tx error"));
      tx.oncomplete = () => res();
    });

    let remaining = await getAllProfiles();
    if (remaining.length === 0) {
      const profile = await createProfileFromSeed();
      const idbLikeProfile = { userID: profile.userID, seedPhrase: profile.seedPhrase, active: true, commited: false };
      await upsertProfile(idbLikeProfile);
      setProfiles([idbLikeProfile]);
      setCurrentProfile(profile);
      return;
    }

    let activeEntry = remaining.find((p) => p.active);
    if (!activeEntry) {
      const fallbackId = remaining[0].userID;
      await setActiveProfileById(fallbackId);
      remaining = await getAllProfiles();
      activeEntry = remaining.find((p) => p.userID === fallbackId) ?? remaining[0];
    }

    setProfiles(remaining);

    if (!activeEntry) return;

    if (removedWasCurrent) {
      const nextProfile = await createProfileFromSeed(activeEntry.seedPhrase);
      nextProfile.commited = activeEntry.commited;
      setCurrentProfile(nextProfile);
    } else if (currentProfile && currentProfile.userID === activeEntry.userID && currentProfile.commited !== activeEntry.commited) {
      setCurrentProfile({ ...currentProfile, commited: activeEntry.commited });
    }
  }, [createProfileFromSeed, currentProfile, getAllProfiles, setActiveProfileById, upsertProfile]);

  const addEmptyProfile = useCallback(async (): Promise<void> => {
    const profile = await createProfileFromSeed();
    const idbLikeProfile = { userID: profile.userID, seedPhrase: profile.seedPhrase, active: false, commited: false };
    await upsertProfile(idbLikeProfile);
    setProfiles([...profiles, idbLikeProfile]);
  }, [profiles]);

  const contextValue: IdentityContextType = {
    currentProfile,
    profiles,
    createProfileFromSeed,
    switchProfile,
    setActiveProfileById,
    addProfileFromSeed,
    eraceIdentities,
    markProfileCommited,
    removeProfile,
    addEmptyProfile
  };

  if (!isReady) return <Loader />;
  return <IdentityContext.Provider value={contextValue}>{children}</IdentityContext.Provider>;
}

export function useIdentitySystem() {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error("useIdentitySystem must be inside provider");
  return ctx;
}
