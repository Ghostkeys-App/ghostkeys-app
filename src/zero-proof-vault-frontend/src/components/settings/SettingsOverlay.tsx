import { useCallback, useMemo, useState } from "react";
import GKModal from "../modals/gk-modal/GKModal.tsx";
import { useNavigate, NavLink, Routes, Route } from "react-router-dom";
import { Cog, Shield, Users } from "lucide-react";
import { useIdentitySystem, type indexDBProfile } from "../../utility/identity";
import { useVaultProviderActions, useVaultProviderState } from "../../utility/vault-provider";
import { toast } from "../../utility/toast/toast.ts";

function GeneralTab() {
  return (
    <div className="gk-settings-section">
      <h2>General</h2>
      <div className="gk-settings-row">
        <div className="label">Theme</div>
        <div className="value muted">System</div>
      </div>
      <div className="gk-settings-row">
        <div className="label">Language</div>
        <div className="value muted">Auto‑detect</div>
      </div>
    </div>
  );
}

function ProfilesTab() {
  const { profiles, removeProfile, addEmptyProfile } = useIdentitySystem();
  const { validateAndImportIdentityWithVaultFromSeed, switchToUncommitedProfile } = useVaultProviderActions();
  const { currentVault } = useVaultProviderState();

  const [revealTarget, setRevealTarget] = useState<indexDBProfile | null>(null);
  const [removeTarget, setRemoveTarget] = useState<indexDBProfile | null>(null);
  const [switchTarget, setSwitchTarget] = useState<indexDBProfile | null>(null);
  const [switchBusy, setSwitchBusy] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);

  const orderedProfiles = useMemo(() => {
    return [...(profiles || [])].sort((a, b) => Number(b.active) - Number(a.active));
  }, [profiles]);

  const handleCopySeed = useCallback(async (seedPhrase?: string) => {
    if (!seedPhrase) return;
    try {
      await navigator.clipboard.writeText(seedPhrase);
      toast.success("Seed phrase copied", { idiotProof: true });
    } catch {
      toast.error("Unable to copy seed phrase", { idiotProof: true });
    }
  }, []);

  const doSwitchProfile = useCallback(async (profile: indexDBProfile) => {
    setSwitchBusy(true);
    if (!profile.commited) {
      try {
        await switchToUncommitedProfile(profile);
        toast.success("Successfully switched profile!", { idiotProof: true });
      } catch (e) {
        toast.error("Error on switching profile, check console!", { idiotProof: true });
      }
       setSwitchBusy(false);
      setSwitchTarget(null);
      return;
    }
    try {
      const success = await validateAndImportIdentityWithVaultFromSeed(profile.seedPhrase);
      if (success) {
        toast.success("Profile switched", { idiotProof: true });
      } else {
        toast.error("Profile not found on backend", { idiotProof: true });
      }
    } catch {
      toast.error("Failed to switch profile", { idiotProof: true });
    } finally {
      setSwitchBusy(false);
      setSwitchTarget(null);
    }
  }, [validateAndImportIdentityWithVaultFromSeed, switchToUncommitedProfile]);

  const onSwitchClick = useCallback((profile: indexDBProfile) => {
    if (profile.active) {
      toast.error("Can't switch to active profile.");
      return;
    }
    if (currentVault && !currentVault.synced) {
      setSwitchTarget(profile);
    } else {
      doSwitchProfile(profile);
    }
  }, [currentVault, doSwitchProfile]);

  const handleRemoveProfile = useCallback(async (profile: indexDBProfile) => {
    setRemoveBusy(true);
    try {
      await removeProfile(profile.userID);
      toast.success("Profile removed from this device", { idiotProof: true });
    } catch {
      toast.error("Failed to remove profile", { idiotProof: true });
    } finally {
      setRemoveBusy(false);
      setRemoveTarget(null);
    }
  }, [removeProfile]);

  // Come up with the better way on how to remember profile. Right now done by switching between the 2
  const handleSaveProfile = useCallback(async (profile: indexDBProfile) => {

  }, [])


  const revealSeedPhrase = revealTarget?.seedPhrase ?? "";
  const removePrincipal = removeTarget ? userIdToPrincipal(removeTarget.userID) : "";
  const switchPrincipal = switchTarget ? userIdToPrincipal(switchTarget.userID) : "";

  return (
    <div className="gk-profiles-settings-section">
      <div className="gk-settings-section">
        <h2>Profiles</h2>
        <p className="muted">Manage identities stored on this device. Reveal, switch, or delete local profiles.</p>

        <div className="gk-profile-list">
          {orderedProfiles.map((profile) => {
            const principal = userIdToPrincipal(profile.userID);
            const shortPrincipal = shortenPrincipal(principal);
            const statusClass = profile.commited ? "success" : "warning";
            const statusLabel = profile.commited ? "Saved to IC" : "Not committed";
            return (
              <div key={profile.userID} className={`gk-profile-card ${profile.active ? 'is-active' : ''}`}>
                <div className="gk-profile-header">
                  <div className="gk-profile-meta">
                    <span className="gk-profile-principal" title={principal}>{shortPrincipal}</span>
                    <div className="gk-profile-badges">
                      {profile.active && <span className="gk-profile-badge success">Active</span>}
                      <span className={`gk-profile-badge ${statusClass}`}>{statusLabel}</span>
                    </div>
                  </div>
                  <button type="button" className="gk-btn ghost" onClick={() => setRevealTarget(profile)}>
                    Reveal seed
                  </button>
                </div>
                <p className="gk-profile-note" title={principal}>{principal}</p>
                <div className="gk-profile-actions">
                  <button
                    type="button"
                    className={`gk-btn ${profile.active ? 'ghost' : 'primary'}`}
                    disabled={profile.active || switchBusy}
                    onClick={() => onSwitchClick(profile)}
                  >
                    {profile.active ? 'Active' : 'Switch'}
                  </button>
                  {/* {!profile.commited && (
                  <button
                    type="button"
                    className="gk-btn ghost"
                    onClick={() => console.log("TODO: create identity on backend", profile.userID)}
                  >
                    Create Identity on IC
                  </button>
                )} */}
                  <button
                    type="button"
                    className="gk-btn danger"
                    disabled={removeBusy}
                    onClick={() => setRemoveTarget(profile)}
                  >
                    Remove from device
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>
      <div className="gk-profile-footer">
        <button
          type="button"
          className="gk-btn primary"
          onClick={async () => await addEmptyProfile()}
        >
          Create new profile
        </button>
      </div>


      <GKModal
        open={!!revealTarget}
        onClose={() => setRevealTarget(null)}
        title="Seed phrase"
        description="Keep this phrase private. Anyone with it can control the profile."
        width="md"
        actions={
          <>
            <button className="gk-btn ghost" onClick={() => handleCopySeed(revealSeedPhrase)}>
              Copy
            </button>
            <button className="gk-btn primary" onClick={() => setRevealTarget(null)}>
              Close
            </button>
          </>
        }
      >
        <p className="gk-seed-text">{revealSeedPhrase}</p>
      </GKModal>

      <GKModal
        open={!!removeTarget}
        onClose={() => { if (!removeBusy) setRemoveTarget(null); }}
        title="Remove this profile?"
        description="Removing a profile clears it from this device. You can re-import it later with the seed phrase."
        width="sm"
        actions={
          <>
            <button className="gk-btn ghost" onClick={() => { if (!removeBusy) setRemoveTarget(null); }} disabled={removeBusy}>
              Cancel
            </button>
            <button
              className="gk-btn danger"
              onClick={() => removeTarget && handleRemoveProfile(removeTarget)}
              disabled={removeBusy}
            >
              Remove
            </button>
          </>
        }
      >
        <div className="gk-form">
          <label className="gk-field">
            <span>Profile</span>
            <input disabled value={removePrincipal} />
          </label>
        </div>
      </GKModal>

      <GKModal
        open={!!switchTarget}
        onClose={() => { if (!switchBusy) setSwitchTarget(null); }}
        title="Unsynced changes detected"
        description="Switching profiles will discard local changes that are not synced yet."
        width="sm"
        actions={
          <>
            <button className="gk-btn ghost" onClick={() => { if (!switchBusy) setSwitchTarget(null); }} disabled={switchBusy}>
              Cancel
            </button>
            <button
              className="gk-btn danger"
              onClick={() => switchTarget && doSwitchProfile(switchTarget)}
              disabled={switchBusy}
            >
              Switch
            </button>
          </>
        }
      >
        <div className="gk-form" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="gk-field">
            <span>Current vault</span>
            <input disabled value={currentVault?.vaultName ?? "--"} />
          </label>
          <label className="gk-field">
            <span>Switch to</span>
            <input disabled value={switchPrincipal} />
          </label>
        </div>
      </GKModal>
    </div>
  );
}

function SecurityTab() {
  return (
    <div className="gk-settings-section">
      <h2>Security</h2>
      <p className="muted">Security, backup and device trust. Coming soon.</p>
    </div>
  );
}

export default function SettingsOverlay() {
  const nav = useNavigate();

  const close = () => {
    nav("/website-logins", { replace: true });
  };

  return (
    <GKModal open={true} onClose={close} title="Settings" hideHeader width="lg">
      <div className="gk-settings">
        {/* Sidebar */}
        <nav className="gk-settings-sidebar">
          <NavLink to="/settings" end className={({ isActive }) => `gk-settings-tab ${isActive ? 'active' : ''}`}>
            <Cog size={16} /><span>General</span>
          </NavLink>
          <NavLink to="/settings/profiles" className={({ isActive }) => `gk-settings-tab ${isActive ? 'active' : ''}`}>
            <Users size={16} /><span>Profiles</span>
          </NavLink>
          <NavLink to="/settings/security" className={({ isActive }) => `gk-settings-tab ${isActive ? 'active' : ''}`}>
            <Shield size={16} /><span>Security</span>
          </NavLink>
        </nav>

        {/* Content */}
        <div className="gk-settings-content">
          <Routes>
            <Route index element={<GeneralTab />} />
            <Route path="profiles" element={<ProfilesTab />} />
            <Route path="security" element={<SecurityTab />} />
          </Routes>
        </div>
      </div>
    </GKModal>
  );
}

function userIdToPrincipal(userID: string): string {
  if (!userID) return "";
  return userID.startsWith("UserID_") ? userID.slice("UserID_".length) : userID;
}

function shortenPrincipal(principal: string): string {
  if (!principal) return principal;
  if (principal.length <= 16) return principal;
  return `${principal.slice(0, 10)}...${principal.slice(-6)}`;
}
