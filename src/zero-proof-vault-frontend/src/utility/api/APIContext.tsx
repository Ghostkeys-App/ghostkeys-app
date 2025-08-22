import { createContext, ReactNode, useContext, useState } from "react";
import { FactoryCanisterAPI, getOrCreateFactoryCanisterActor, getOrCreateSharedCanisterActor, SharedCanisterAPI } from ".";
import { Principal } from "@dfinity/principal";
import { useIdentitySystem } from "../identity";
import { GhostkeysVetKdArgs } from "../../../../declarations/shared-vault-canister-backend/shared-vault-canister-backend.did";
import { generateGhostKeysArgs } from "../crypto/encdcrpt";

export type APIContextType = {
    getFactoryCanisterAPI: () => Promise<FactoryCanisterAPI>;
    getSharedVaultCanisterAPI: () => Promise<SharedCanisterAPI>;
    getVetKDDerivedKey: () => Promise<Uint8Array>;
};

/**
 * API Context to call our canisters
*/

const APIContext = createContext<APIContextType | undefined>(undefined);
export function APIContextProvider({ children }: { children: ReactNode }) {
    const [sharedVaultCanisterId, setSharedVaultCanisterId] = useState<Principal>();
    const [vetKDDerivedKey, setVetKDDerivedKey] = useState<Uint8Array>();
    const { currentProfile } = useIdentitySystem();

    // Helpers
    const interrogateFactoryForSharedCanister = async (): Promise<Principal> => {
        const apiToCall = await getFactoryCanisterAPI();
        const sharedCanisterPrincipal = await apiToCall.get_shared_vault();
        setSharedVaultCanisterId(sharedCanisterPrincipal);
        return sharedCanisterPrincipal;
    }

    const interrogateSharedForVetKey = async (): Promise<Uint8Array> => {
        let validVetKD: Uint8Array;
        const apiToCall = await getSharedVaultCanisterAPI();
        const vetKD = (await apiToCall.get_vetkey_for_user(currentProfile.principal.toString()))[0];
        if (vetKD)
            validVetKD = new Uint8Array(vetKD);
        else {
            const vetKDArgs: GhostkeysVetKdArgs = await generateGhostKeysArgs(currentProfile.principal);
            const derivedVetKD = await apiToCall.derive_vetkd_encrypted_key(vetKDArgs);
            if ('Ok' in derivedVetKD)
                validVetKD = new Uint8Array(derivedVetKD.Ok);
            else {
                console.warn("Couldn't derive VetKD. Error: ", derivedVetKD.Err);
                validVetKD = new Uint8Array();
            }
        }
        setVetKDDerivedKey(validVetKD.length > 0 ? validVetKD : undefined);
        return validVetKD;
    }

    // Context Methods
    const getFactoryCanisterAPI = async (): Promise<FactoryCanisterAPI> => {
        const factoryCanisterId = process.env.CANISTER_ID_FACTORY_CANISTER_BACKEND ?? 'not-found';
        const factoryActorAPI = await getOrCreateFactoryCanisterActor(factoryCanisterId);
        return factoryActorAPI;
    }

    const getSharedVaultCanisterAPI = async (): Promise<SharedCanisterAPI> => {
        const sharedCanisterId = sharedVaultCanisterId ?? await interrogateFactoryForSharedCanister();
        const sharedActorAPI = await getOrCreateSharedCanisterActor(sharedCanisterId);
        return sharedActorAPI;
    }

    const getVetKDDerivedKey = async (): Promise<Uint8Array> => {
        const vetKD = vetKDDerivedKey ?? await interrogateSharedForVetKey();
        return vetKD;
    }

    const contextValue: APIContextType = {
        getFactoryCanisterAPI,
        getSharedVaultCanisterAPI,
        getVetKDDerivedKey
    }
    return <APIContext.Provider value={contextValue}>{children}</APIContext.Provider>;
}

export function useAPIContext() {
    const ctx = useContext(APIContext);
    if (!ctx) throw new Error("useAPIContext must be inside provider");
    return ctx;
}