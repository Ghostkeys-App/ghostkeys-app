// import { useState } from "react";
// import { useIdentitySystem } from "../utility/identity";
// import "../styles/theme.scss";
// import { useVaultProviderState } from "../utility/vault-provider";
//
// interface TopBarProps {
//   profile: any;
//   selected: "logins" | "notes" | "payments" | "grid";
// }
//
// export default function TopBar({ profile, selected }: TopBarProps) {
//   const { currentProfile } = useIdentitySystem();
//   const id = currentProfile?.principal.toString() || "";
//   const [showCopied, setShowCopied] = useState(false);
//
//   const { syncVaultsWithBackend } = useVaultProviderState();
//
//
//   const shortenId = (id: string): string => {
//     if (!id || id.length <= 16) return id;
//     return `${id.slice(0, 8)}..${id.slice(-6)}`;
//   };
//
//   const copyToClipboard = async () => {
//     if (id) {
//       try {
//         await navigator.clipboard.writeText(id);
//         setShowCopied(true);
//         setTimeout(() => setShowCopied(false), 1500);
//       } catch (err) {
//         console.error("Failed to copy: ", err);
//         // Fallback for older browsers
//         const textArea = document.createElement("textarea");
//         textArea.value = id;
//         document.body.appendChild(textArea);
//         textArea.focus();
//         textArea.select();
//         try {
//           document.execCommand("copy");
//           setShowCopied(true);
//           setTimeout(() => setShowCopied(false), 1500);
//         } catch (fallbackErr) {
//           console.error("Fallback copy failed: ", fallbackErr);
//         }
//         document.body.removeChild(textArea);
//       }
//     }
//   };
//   const toggleTheme = () => {
//     document.body.classList.toggle("dark");
//     localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
//   };
//
//   const exportToFile = () => {
//     alert("🔄 Export to file clicked (functionality not yet implemented)");
//     // You can later trigger actual download here.
//   };
//
//   const saveToChain = async () => {
//     try {
//       await syncVaultsWithBackend();
//       alert("Vaults synced to chain");
//     } catch (err) {
//       console.error("Sync failed", err);
//       alert("Failed to sync with backend");
//     }
//   };
//
//   const getTopBarColor = (template: "logins" | "notes" | "payments" | "grid") => {
//     switch (template) {
//       case "logins": {return '#2F3A70'}
//       case "notes": {return '#FFD18D'}
//       case "payments": {return '#EC748F'}
//       case "grid": {return '#704481'}
//     }
//   }
//
//   return (
//     <div className="topbar" style={{
//       backgroundColor: getTopBarColor(selected),
//       borderColor: selected == 'logins' || selected == 'grid' ? 'var(--light-border-color)' : 'var(--dark-border-color)',
//       color: selected == 'logins' || selected == 'grid' ? 'white' : 'black'
//     }}>
//       <div className="header-left">
//         <div className="logo-container">
//           <img src={selected == 'logins' || selected == 'grid' ? '/white-logo.png' : '/black-logo.png'} alt={'logo'}
//                className={'logo'}></img>
//         </div>
//         <div className="profile">
//           <img src={selected == 'logins' || selected == 'grid' ? '/ghost-white.png' : '/ghost-black.png'} alt={'logo'}
//                className={'profile-icon'}></img>
//           {profile?.nickname || "Anon"}
//           {id && (
//               <div
//                   className={`copy-box ${showCopied ? 'copied' : ''}`}
//                   onClick={copyToClipboard}
//                   title={`Click to copy full ID: ${id}`}
//                   style={{
//                     borderColor: selected == 'logins' || selected == 'grid' ? 'var(--light-border-color)' : 'var(--dark-border-color)',
//                   }}
//               >
//                 {showCopied ? "Copied ✓" : shortenId(id)}
//               </div>
//           )}
//         </div>
//       </div>
//
//       <div className="toolbar">
//         <button onClick={exportToFile}>📤 Export</button>
//         <button onClick={saveToChain}>🔐 Save</button>
//         <button onClick={toggleTheme}>🌓</button>
//       </div>
//     </div>
//   );
// }
