import { Actor, ActorConfig, ActorSubclass, Agent, HttpAgent, HttpAgentOptions } from "@dfinity/agent";
import { InterfaceFactory } from "@dfinity/candid/lib/cjs/idl";
import { Principal } from "@dfinity/principal";

export interface CreateActorOptions {
    /**
     * @see {@link Agent}
     */
    agent?: Agent;
    /**
     * @see {@link HttpAgentOptions}
     */
    agentOptions?: HttpAgentOptions;
    /**
     * @see {@link ActorConfig}
     */
    actorOptions?: ActorConfig;
}


export const createActor = async <T>(canisterId: string | Principal, options: CreateActorOptions = {}, idlFactory: InterfaceFactory): Promise<ActorSubclass<T>> => {
    const agent = options.agent || await HttpAgent.create();

    if (options.agent && options.agentOptions) {
        console.warn(
            "Detected both agent and agentOptions passed to createActor. Ignoring agentOptions and proceeding with the provided agent."
        );
    }

    // Fetch root key for certificate validation during development
    if (process.env.DFX_NETWORK !== "ic") {
        agent.fetchRootKey().catch((err) => {
            console.warn(
                "Unable to fetch root key. Check to ensure that your local replica is running"
            );
            console.error(err);
        });
    }

    // Creates an actor with using the candid interface and the HttpAgent
    return Actor.createActor(idlFactory, {
        agent,
        canisterId,
        ...options.actorOptions,
    });
};