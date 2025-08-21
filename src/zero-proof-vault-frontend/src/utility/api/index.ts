import { HttpAgent, ActorSubclass } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { createActor } from "./callWithAgent";

import { _SERVICE as factoryCanisterType, idlFactory as factoryCanisterIDL } from '../../../../declarations/factory-canister-backend/factory-canister-backend.did';
import { _SERVICE as sharedCanisterType, idlFactory as sharedCanisterIDL } from '../../../../declarations/shared-vault-canister-backend/shared-vault-canister-backend.did';
import { _SERVICE as privateCanisterType, idlFactory as privateCanisterIDL } from '../../../../declarations/vault-canister-backend/vault-canister-backend.did';

export interface GhostkeysActors {
    FactoryCanisterActor: ActorSubclass<factoryCanisterType> | undefined,
    SharedCanisterActor: ActorSubclass<sharedCanisterType> | undefined,
    VaultCanisterActor: ActorSubclass<privateCanisterType> | undefined,
}

const ACTORS: GhostkeysActors = {
    FactoryCanisterActor: undefined,
    SharedCanisterActor: undefined,
    VaultCanisterActor: undefined
}

export const getOrCreateFactoryCanisterActor = async (canisterId: string | Principal, httpAgent: HttpAgent): Promise<ActorSubclass<factoryCanisterType>> => {
    if (!ACTORS.FactoryCanisterActor) {
        ACTORS.FactoryCanisterActor = await createActor<factoryCanisterType>(canisterId, { agent: httpAgent }, factoryCanisterIDL);
    }
    return ACTORS.FactoryCanisterActor;
}

export const getOrCreateSharedCanisterActor = async (canisterId: string | Principal, httpAgent: HttpAgent): Promise<ActorSubclass<sharedCanisterType>> => {
    if (!ACTORS.SharedCanisterActor) {
        ACTORS.SharedCanisterActor = await createActor<sharedCanisterType>(canisterId, { agent: httpAgent }, sharedCanisterIDL);
    }
    return ACTORS.SharedCanisterActor;
}

export const getOrCreatePrivateCanisterActor = async (canisterId: string | Principal, httpAgent: HttpAgent): Promise<ActorSubclass<privateCanisterType>> => {
    if (!ACTORS.VaultCanisterActor) {
        ACTORS.VaultCanisterActor = await createActor<privateCanisterType>(canisterId, { agent: httpAgent }, privateCanisterIDL);
    }
    return ACTORS.VaultCanisterActor;
}