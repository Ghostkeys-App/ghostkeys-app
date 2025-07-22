use candid::{CandidType, Deserialize, Encode, Decode};
use ic_stable_structures::{storable::Storable, storable::Bound};
use std::{borrow::Cow};


// ---- Types ----
pub type UserId = [u8; 32]; // could be hash of Principal or public key

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
    const BOUND: Bound = Bound::Bounded {
        max_size: 32_768, // ~32KB per vault
        is_fixed_size: false,
    };
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