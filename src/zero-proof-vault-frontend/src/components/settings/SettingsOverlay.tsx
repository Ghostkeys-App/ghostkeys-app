import GKModal from "../modals/gk-modal/GKModal.tsx";
import { useNavigate, useLocation, NavLink, Routes, Route } from "react-router-dom";
import { Cog, Shield, Users } from "lucide-react";

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
  return (
    <div className="gk-settings-section">
      <h2>Profiles</h2>
      <p className="muted">Manage identities and seeds. Coming soon.</p>
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
  const loc = useLocation();

  const close = () => {
    nav("/website-logins", { replace: true });
    // try {
    //   // Go back if possible, otherwise home
    //   if (window.history.length > 1) nav(-1);
    //   else nav("/website-logins", { replace: true });
    // } catch {
    //   nav("/website-logins", { replace: true });
    // }
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

