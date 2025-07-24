import { useState } from "react";
import { useIdentitySystem } from "../utility/identity";
import "../styles/theme.scss";
import { useVaultProvider } from "../utility/vault-provider";

interface TopBarProps {
  profile: any;
}

export default function TopBar({ profile }: TopBarProps) {
  const { currentProfile } = useIdentitySystem();
  const id = currentProfile?.icpPublicKey || "";
  const [showCopied, setShowCopied] = useState(false);

  const { syncVaultsWithBackend } = useVaultProvider();


  const shortenId = (id: string): string => {
    if (!id || id.length <= 16) return id;
    return `${id.slice(0, 8)}..${id.slice(-6)}`;
  };

  const copyToClipboard = async () => {
    if (id) {
      try {
        await navigator.clipboard.writeText(id);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 1500);
      } catch (err) {
        console.error("Failed to copy: ", err);
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = id;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand("copy");
          setShowCopied(true);
          setTimeout(() => setShowCopied(false), 1500);
        } catch (fallbackErr) {
          console.error("Fallback copy failed: ", fallbackErr);
        }
        document.body.removeChild(textArea);
      }
    }
  };
  const toggleTheme = () => {
    document.body.classList.toggle("dark");
    localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
  };

  const exportToFile = () => {
    alert("🔄 Export to file clicked (functionality not yet implemented)");
    // You can later trigger actual download here.
  };

  const saveToChain = async () => {
    try {
      await syncVaultsWithBackend();
      alert("Vaults synced to chain");
    } catch (err) {
      console.error("Sync failed", err);
      alert("Failed to sync with backend");
    }
  };

  return (
    <div className="topbar">
      <div className="header-left">
        <h1>Ghostkeys</h1>
        <div className="profile">
          <div className="profile-icon"></div>
          {profile?.nickname || "Anon"}
          {id && (
            <div
              className={`copy-box ${showCopied ? 'copied' : ''}`}
              onClick={copyToClipboard}
              title={`Click to copy full ID: ${id}`}
            >
              {showCopied ? "Copied ✓" : shortenId(id)}
            </div>
          )}
        </div>
      </div>
      <div className="toolbar">
        <button onClick={exportToFile}>📤 Export</button>
        <button onClick={saveToChain}>🔐 Save</button>
        <button onClick={toggleTheme}>🌓</button>
      </div>
    </div>
  );
}
