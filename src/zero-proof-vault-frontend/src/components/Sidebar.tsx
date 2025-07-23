import { useEffect, useRef, useState } from "react";
import { useIdentitySystem } from "../utility/identity";
import "../styles/theme.scss";

export default function Sidebar() {
    const { listVaults, switchVault, createVault, currentVault, renameVault, deleteVault } = useIdentitySystem();
    const [vaults, setVaults] = useState<any[]>([]);
    const [editingVaultID, setEditingVaultID] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const loadVaults = async () => {
            const list = await listVaults();
            setVaults(list);
        };
        loadVaults();
    }, [listVaults]);

    useEffect(() => {
        if (editingVaultID && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingVaultID]);

    const handleSwitch = async (vault: any) => {
        await switchVault(vault);
    };

    const handleCreate = async () => {
        try {
            const newVault = await createVault("New Vault");
            setVaults([...vaults, newVault]);
            await switchVault(newVault);
        } catch (error) {
            console.error("Failed to create vault:", error);
            alert("Failed to create vault. Please try again.");
        }
    };

    const handleRename = async (vaultID: string, newName: string) => {
        if (newName.trim() === "") {
            setEditingVaultID(null);
            return;
        }
        
        try {
            const vault = vaults.find((v) => v.vaultID === vaultID);
            if (vault) {
                const updated = { ...vault, nickname: newName.trim() };
                await renameVault(vaultID, newName.trim());
                setVaults(vaults.map((v) => (v.vaultID === vaultID ? updated : v)));
            }
            setEditingVaultID(null);
        } catch (error) {
            console.error("Failed to rename vault:", error);
            alert("Failed to rename vault. Please try again.");
            setEditingVaultID(null);
        }
    };

    const handleDelete = async (vault: any) => {
        const confirmDelete = window.confirm(
            `Are you sure you want to delete "${vault.nickname || "Untitled"}"? This action cannot be undone.`
        );
        
        if (!confirmDelete) return;

        try {
            await deleteVault(vault.vaultID);
            const updatedVaults = vaults.filter((v) => v.vaultID !== vault.vaultID);
            setVaults(updatedVaults);
            
            // If there are remaining vaults and we deleted the current one, switch to the first one
            if (updatedVaults.length > 0 && currentVault?.vaultID === vault.vaultID) {
                await switchVault(updatedVaults[0]);
            }
        } catch (error) {
            console.error("Failed to delete vault:", error);
            alert("Failed to delete vault. Please try again.");
        }
    };

    return (
        <div className="sidebar full-height">
            <div className="sidebar-header">
                <h3>Vaults</h3>
            </div>

            <div className="vault-content">
                <div className="vault-list">
                    {vaults.map((vault) => (
                        <div key={vault.vaultID} className="vault-item">
                            <div className="vault-item-content">
                                {editingVaultID === vault.vaultID ? (
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        defaultValue={vault.nickname}
                                        onBlur={(e) => handleRename(vault.vaultID, e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                handleRename(vault.vaultID, (e.target as HTMLInputElement).value);
                                            } else if (e.key === "Escape") {
                                                setEditingVaultID(null);
                                            }
                                        }}
                                    />
                                ) : (
                                    <button
                                        className={`vault-btn ${vault.vaultID === currentVault?.vaultID ? "active" : ""}`}
                                        onClick={() => handleSwitch(vault)}
                                        onDoubleClick={() => setEditingVaultID(vault.vaultID)}
                                        title="Double-click to rename"
                                    >
                                        {vault.nickname || "Untitled"}
                                    </button>
                                )}
                                {!editingVaultID && vaults.length > 1 && (
                                    <button
                                        className="vault-delete-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(vault);
                                        }}
                                        title="Delete vault"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <button className="create-btn" onClick={handleCreate}>
                    ➕ New Vault
                </button>
            </div>
        </div>

    );
}
