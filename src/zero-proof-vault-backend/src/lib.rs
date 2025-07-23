
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

    static VAULTS_MAP: RefCell<StableBTreeMap<VaultKey, VaultData, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.get(MemoryId::new(0)))
        )
    );
}

// ---- Canister Methods ----

#[update]
fn add_or_update_vault(user_id: UserId, vault_id: VaultId, vault: VaultData) {
    VAULTS_MAP.with(|map| {
        map.borrow_mut().insert(VaultKey { user_id, vault_id }, vault);
    });
}

#[query]
fn get_vault(user_id: UserId, vault_id: VaultId) -> Option<VaultData> {
    VAULTS_MAP.with(|map| map.borrow().get(&VaultKey { user_id, vault_id }))
}

#[query]
fn get_all_vaults_for_user(user_id: UserId) -> Vec<(VaultId, VaultData)> {
    VAULTS_MAP.with(|map| {
        map.borrow()
            .iter()
            .filter_map(|entry| {
                let VaultKey { user_id: uid, vault_id: vid } = entry.key();
                let data = entry.value();
                if uid == &user_id {
                    Some((vid.clone(), data.clone()))
                } else {
                    None
                }
            })
            .collect()
    })
}

#[query]
fn user_exists(user_id: UserId) -> bool {
    VAULTS_MAP.with(|map| {
        map.borrow()
            .iter()
            .any(|entry| entry.key().user_id == user_id) // Innefficient, but simple
    })
}

#[update]
fn delete_vault(user_id: UserId, vault_id: VaultId) {
    VAULTS_MAP.with(|map| {
        map.borrow_mut().remove(&VaultKey { user_id, vault_id });
    });
}  

#[update]
fn clear_all_user_vaults(user_id: UserId) {
    VAULTS_MAP.with(|map| {
        let mut map = map.borrow_mut();
        let keys_to_delete: Vec<_> = map
            .iter()
            .filter_map(|entry| {
                let VaultKey { user_id: uid, vault_id: vid } = entry.key();
                (uid == &user_id).then(|| VaultKey { user_id: uid.clone(), vault_id: vid.clone() })
            })
            .collect();

        for key in keys_to_delete {
            map.remove(&key);
        }
    });
}

#[update]
fn apply_config_changes(changes: Vec<(UserId, VaultId, VaultData)>) {
    VAULTS_MAP.with(|map| {
        let mut map = map.borrow_mut();
        for (user_id, vault_id, vault_data) in changes {
            map.insert(VaultKey { user_id, vault_id }, vault_data);
        }
    });
}

// ---- Export DID ----
ic_cdk::export_candid!();
