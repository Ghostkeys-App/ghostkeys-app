import { createContext, ReactNode, useContext, useState } from "react";
import { FactoryCanisterAPI, getOrCreateFactoryCanisterActor, getOrCreateSharedCanisterActor, SharedCanisterAPI } from ".";
import { Principal } from "@dfinity/principal";

export type APIContextType = {
    getFactoryCanisterAPI: () => Promise<FactoryCanisterAPI>;
    getSharedVaultCanisterAPI: () => Promise<SharedCanisterAPI>;
};

/**
 * API Context to call our canisters
 */

const APIContext = createContext<APIContextType | undefined>(undefined);
export function APIContextProvider({ children }: { children: ReactNode }) {
    const [sharedVaultCanisterId, setSharedVaultCanisterId] = useState<Principal>();

    // Helpers
    const interrogateFactoryForSharedCanister = async (): Promise<Principal> => {
        const apiToCall = await getFactoryCanisterAPI();
        const sharedCanisterPrincipal = await apiToCall.get_shared_vault();
        setSharedVaultCanisterId(sharedCanisterPrincipal);
        return sharedCanisterPrincipal;
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

    const contextValue: APIContextType = {
        getFactoryCanisterAPI,
        getSharedVaultCanisterAPI
    }
    return <APIContext.Provider value={contextValue}>{children}</APIContext.Provider>;
}

export function useAPIContext() {
    const ctx = useContext(APIContext);
    if (!ctx) throw new Error("useAPIContext must be inside provider");
    return ctx;
}