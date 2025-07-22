
use ic_cdk_macros::{query, update};
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, StableBTreeMap,
};
use std::{cell::RefCell};
mod vault_types;
use vault_types::*;

type Memory = VirtualMemory<DefaultMemoryImpl>;

// ---- Setup Memory Manager ----
thread_local! {
    static MEMORY_MANAGER: MemoryManager<DefaultMemoryImpl> = 
        MemoryManager::init(DefaultMemoryImpl::default());

    static VAULTS_MAP: RefCell<StableBTreeMap<UserId, VaultData, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.get(MemoryId::new(0)))
        )
    );
}

// ---- Canister Methods ----

#[update]
fn add_or_update_vault(user_id: UserId, vault: VaultData) {
    VAULTS_MAP.with(|map| {
        map.borrow_mut().insert(user_id, vault);
    });
}

#[query]
fn get_my_vault(user_id: UserId) -> Option<VaultData> {
    VAULTS_MAP.with(|map| map.borrow().get(&user_id))
}

// ---- Export DID ----
ic_cdk::export_candid!();
