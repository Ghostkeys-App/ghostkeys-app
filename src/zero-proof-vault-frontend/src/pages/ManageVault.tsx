// ManageVault.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIdentitySystem } from "../utility/identity";
import { zero_proof_vault_backend } from "../../../declarations/zero-proof-vault-backend";
import Sidebar from "../components/Sidebar";
import VaultTable from "../components/VaultTable";
import TopBar from "../components/TopBar";
import "../styles/theme.scss";
import { decryptMetaBlob } from "../utility/crypto/encdcrpt";

export default function ManageVault() {
  const navigate = useNavigate();
  const { currentProfile, currentVault } = useIdentitySystem();

  const [signedKey, setKey] = useState<Uint8Array | null>(null);
  const [blobs, setBlobs] = useState<Array<{ blob: string; url: string; username: string }>>([]);
  const [recordBlob, setRecordBlob] = useState<Array<Record<string, string>>>([]);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadVaultData = async () => {
      if (!currentProfile || !currentProfile.icpAccount || !currentVault) {
        navigate("/");
        return;
      }

      try {
        const identity = currentProfile.icpAccount.identity;
        const signature = await identity.sign(new TextEncoder().encode(currentVault.vaultID));
        const keyMaterial = await crypto.subtle.digest("SHA-256", signature);
        const derivedKey = new Uint8Array(keyMaterial).slice(0, 32);

        setKey(derivedKey);

        const users = await zero_proof_vault_backend.get_all_users();
        const decoded = await Promise.all(
          users.map(async (blob) => {
            try {
              const { url, username } = await decryptMetaBlob(blob, derivedKey);
              return { blob, url, username };
            } catch {
              return { blob, url: "❌ Decryption Error", username: "❌" };
            }
          })
        );
        setBlobs(decoded);
      } catch (error) {
        console.error("Error loading vault:", error);
      } finally {
        setLoading(false);
      }
    };

    loadVaultData();
  }, [currentProfile, currentVault, navigate]);

  if (loading) {
    return (
      <div className="flex-center flex-column">
        <div className="card text-center">
          <div className="loading" style={{ width: '40px', height: '40px', margin: '20px auto' }}></div>
          <h3>Loading Your Vault...</h3>
          <p>Please wait while we securely load your password entries.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vault-app">
      <TopBar profile={currentProfile} />
      <div className="vault-layout">
        <Sidebar />
        <VaultTable
          blobs={recordBlob}
          passwords={passwords}
          setPasswords={setPasswords}
          signedKey={signedKey}
          setBlobs={setRecordBlob}
        />
      </div>
    </div>
  );
}
