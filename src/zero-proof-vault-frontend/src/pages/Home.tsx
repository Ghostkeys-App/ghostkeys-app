// // Home.tsx
// import { useEffect, useRef, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { useIdentitySystem } from "../utility/identity";
//
// export default function Home() {
//   const navigate = useNavigate();
//   const { listVaults, switchVault, createVault, currentProfile } = useIdentitySystem();
//   const [vaultNumber, setVaultNumber] = useState(1);
//
//   const initCalledRef = useRef(false);
//
//   useEffect(() => {
//     if (initCalledRef.current) return;
//     initCalledRef.current = true;
//
//     const init = async () => {
//       const vaults = await listVaults();
//       if (vaults.length > 0) {
//         switchVault(vaults[0]);
//       } else {
//         const newVault = await createVault(`Vault ${vaultNumber}`);
//         switchVault(newVault);
//         setVaultNumber(vaultNumber + 1);
//       }
//       navigate("/manage");
//     };
//     init();
//   }, [navigate]);
//
//   return <div>Redirecting...</div>;
// }
