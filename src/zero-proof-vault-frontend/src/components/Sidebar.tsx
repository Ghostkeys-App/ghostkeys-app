// import { useEffect, useRef, useState } from "react";
// import { useIdentitySystem } from "../utility/identity";
// import "../styles/theme.scss";
//
// export default function Sidebar() {
//     const { listVaults, switchVault, createVault, currentVault, renameVault } = useIdentitySystem();
//     const [vaults, setVaults] = useState<any[]>([]);
//     const [editingVaultID, setEditingVaultID] = useState<string | null>(null);
//     const inputRef = useRef<HTMLInputElement>(null);
//
//     useEffect(() => {
//         const loadVaults = async () => {
//             const list = await listVaults();
//             setVaults(list);
//         };
//         loadVaults();
//     }, [listVaults]);
//
//     useEffect(() => {
//         if (editingVaultID && inputRef.current) {
//             inputRef.current.focus();
//         }
//     }, [editingVaultID]);
//
//     const handleSwitch = async (vault: any) => {
//         await switchVault(vault);
//     };
//
//     const handleCreate = async () => {
//         const newVault = await createVault("");
//         setVaults([...vaults, newVault]);
//         setEditingVaultID(newVault.vaultID);
//         await switchVault(newVault);
//     };
//
//     const handleRename = async (vaultID: string, newName: string) => {
//         const vault = vaults.find((v) => v.vaultID === vaultID);
//         if (vault) {
//             const updated = { ...vault, nickname: newName };
//             renameVault(vaultID, newName);
//             setVaults(vaults.map((v) => (v.vaultID === vaultID ? updated : v)));
//         }
//         setEditingVaultID(null);
//     };
//
//     return (
//         <div className="sidebar full-height">
//             <div className="sidebar-header">
//                 <h3>Vaults</h3>
//             </div>
//
//             <div className="vault-content">
//                 <div className="vault-list">
//                     {vaults.map((vault) => (
//                         <div key={vault.vaultID} className="vault-item">
//                             {editingVaultID === vault.vaultID ? (
//                                 <input
//                                     ref={inputRef}
//                                     type="text"
//                                     defaultValue={vault.nickname}
//                                     onBlur={(e) => handleRename(vault.vaultID, e.target.value)}
//                                     onKeyDown={(e) => {
//                                         if (e.key === "Enter") {
//                                             handleRename(vault.vaultID, (e.target as HTMLInputElement).value);
//                                         }
//                                     }}
//                                 />
//                             ) : (
//                                 <button
//                                     className={`vault-btn ${vault.vaultID === currentVault?.vaultID ? "active" : ""}`}
//                                     onClick={() => handleSwitch(vault)}
//                                     onDoubleClick={() => setEditingVaultID(vault.vaultID)}
//                                 >
//                                     {vault.nickname || "Untitled"}
//                                 </button>
//                             )}
//                         </div>
//                     ))}
//                 </div>
//                 <button className="create-btn" onClick={handleCreate}>
//                     ➕ New Vault
//                 </button>
//             </div>
//         </div>
//
//     );
// }
