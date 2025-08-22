import { HttpAgent, ActorSubclass } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { createActor } from "./callWithAgent";

import { _SERVICE as factoryCanisterType } from '../../../../declarations/factory-canister-backend/factory-canister-backend.did';
import { idlFactory as factoryCanisterIDL } from '../../../../declarations/factory-canister-backend/index';
import { _SERVICE as sharedCanisterType } from '../../../../declarations/shared-vault-canister-backend/shared-vault-canister-backend.did';
import { idlFactory as sharedCanisterIDL } from '../../../../declarations/shared-vault-canister-backend/index';
import { _SERVICE as privateCanisterType } from '../../../../declarations/vault-canister-backend/vault-canister-backend.did';
import { idlFactory as privateCanisterIDL } from '../../../../declarations/vault-canister-backend/index';

export type FactoryCanisterAPI = ActorSubclass<factoryCanisterType>;
export type SharedCanisterAPI = ActorSubclass<sharedCanisterType>;
export type VaultCanisterAPI = ActorSubclass<privateCanisterType>;

export interface GhostkeysActors {
    FactoryCanisterActor: FactoryCanisterAPI | undefined,
    SharedCanisterActor: SharedCanisterAPI | undefined,
    VaultCanisterActor: VaultCanisterAPI | undefined,
}

const ACTORS: GhostkeysActors = {
    FactoryCanisterActor: undefined,
    SharedCanisterActor: undefined,
    VaultCanisterActor: undefined
}

// Calling those, each actor will have separate https agent attached
export const getOrCreateFactoryCanisterActor = async (canisterId: string | Principal, httpAgent?: HttpAgent): Promise<FactoryCanisterAPI> => {
    if (!ACTORS.FactoryCanisterActor) {
        ACTORS.FactoryCanisterActor = await createActor<factoryCanisterType>(canisterId, { agent: httpAgent }, factoryCanisterIDL);
    }
    return ACTORS.FactoryCanisterActor;
}

export const getOrCreateSharedCanisterActor = async (canisterId: string | Principal, httpAgent?: HttpAgent): Promise<SharedCanisterAPI> => {
    if (!ACTORS.SharedCanisterActor) {
        ACTORS.SharedCanisterActor = await createActor<sharedCanisterType>(canisterId, { agent: httpAgent }, sharedCanisterIDL);
    }
    return ACTORS.SharedCanisterActor;
}

export const getOrCreatePrivateCanisterActor = async (canisterId: string | Principal, httpAgent?: HttpAgent): Promise<VaultCanisterAPI> => {
    if (!ACTORS.VaultCanisterActor) {
        ACTORS.VaultCanisterActor = await createActor<privateCanisterType>(canisterId, { agent: httpAgent }, privateCanisterIDL);
    }
    return ACTORS.VaultCanisterActor;
}