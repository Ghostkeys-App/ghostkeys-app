use candid::{CandidType, Deserialize, Encode, Decode};
use ic_stable_structures::{storable::Storable, storable::Bound};
use std::{borrow::Cow};


// ---- Types ----
pub type UserId = String; // could be hash of Principal or public key
pub type VaultId = String; // could be hash of Vault name

#[derive(CandidType, Deserialize, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct VaultKey {
    pub user_id: UserId,
    pub vault_id: VaultId,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct VaultData {
    pub name: String,         
    pub columns: Vec<Column>, 
    pub rows: Vec<Row>,       
}

#[derive(CandidType, Deserialize, Clone)]
pub struct Column {
    pub id: String,
    pub name: String, 
    pub hidden: bool, // if true -> treat as secret
}

#[derive(CandidType, Deserialize, Clone)]
pub struct Row {
    pub id: String,
    pub values: Vec<String>, // Encrypted cells
}

// Uses Candid for serialization - this is not efficient, but simple.
impl Storable for VaultData {
    const BOUND: Bound = Bound::Unbounded;
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Owned(Encode!(&self).expect("Failed to encode VaultData"))
    }
    fn into_bytes(self) -> Vec<u8> {
        Encode!(&self).expect("Failed to encode VaultData").into()
    }
    fn from_bytes(bytes: Cow<'_, [u8]>) -> Self {
        Decode!(&bytes, VaultData).expect("Failed to decode VaultData")
    }
}

impl Storable for VaultKey {
    // Max size in bytes, add more if you expect longer strings
    const BOUND: Bound = Bound::Bounded {
        max_size: 512, // 256 bytes for user_id, 256 for vault_id
        is_fixed_size: false,
    };

    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Owned(Encode!(&self).expect("Failed to encode VaultKey"))
    }

    fn from_bytes(bytes: Cow<'_, [u8]>) -> Self {
        Decode!(&bytes, VaultKey).expect("Failed to decode VaultKey")
    }

     fn into_bytes(self) -> Vec<u8> {
        Encode!(&self).expect("Failed to encode VaultKey").into()
    }
}