use std::collections::HashMap;
use candid::{CandidType, Deserialize};
use ic_cdk_macros::{query, update};
use std::cell::RefCell;

thread_local! {
    static VAULT_MAP: RefCell<HashMap<String, String>> = RefCell::new(HashMap::new());
}

#[query]
fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}

#[update]
fn add_entry(encrypted_blob: String, encrypted_pw_blob: String) {
    VAULT_MAP.with(|vault| {
        vault.borrow_mut().insert(encrypted_blob, encrypted_pw_blob);
    });
}

#[derive(CandidType, Deserialize)]
struct VaultEntry {
    metadata: String,
    blobdata: String,
}

#[update]
fn add_entries_from_array(entries: Vec<VaultEntry>) {
    VAULT_MAP.with(|vault| {
        let mut map = vault.borrow_mut();
        for entry in entries {
            map.insert(entry.metadata, entry.blobdata);
        }
    });
}

#[query]
fn get_pw_entry_by_blob(encrypted_blob: String) -> Option<String> {
    VAULT_MAP.with(|vault| vault.borrow().get(&encrypted_blob).cloned())
}

#[query]
fn get_all_users() -> Vec<String> {
    VAULT_MAP.with(|vault| vault.borrow().keys().cloned().collect())
}

#[update]
fn delete_entry_by_blob(encrypted_blob: String) -> Option<String> {
    VAULT_MAP.with(|vault| vault.borrow_mut().remove(&encrypted_blob))
}

#[update]
fn drop_storage() {
    VAULT_MAP.with(|vault| vault.borrow_mut().clear());
}

// Export the interface for the smart contract.
ic_cdk::export_candid!();
