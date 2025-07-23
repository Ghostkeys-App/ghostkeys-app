// Home.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useIdentitySystem } from "../utility/identity";

export default function Home() {
  const navigate = useNavigate();
  const { listVaults, switchVault, createVault } = useIdentitySystem();

  useEffect(() => {
    const init = async () => {
      const vaults = await listVaults();
      if (vaults.length > 0) {
        await switchVault(vaults[0]);
      } else {
        const newVault = await createVault("My First Vault");
        await switchVault(newVault);
      }
      navigate("/manage");
    };
    init();
  }, [navigate, listVaults, switchVault, createVault]);

  return <div>Redirecting...</div>;
}
