import React from "react";
import "../styles/theme.scss";

interface TopBarProps {
  profile: any;
}

export default function TopBar({ profile }: TopBarProps) {
  const toggleTheme = () => {
    document.body.classList.toggle("dark");
    localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
  };

  const exportToFile = () => {
    alert("🔄 Export to file clicked (functionality not yet implemented)");
    // You can later trigger actual download here.
  };

  const saveToChain = () => {
    alert("📡 Save to chain clicked (functionality not yet implemented)");
    // This would later push updates to your backend
  };

  return (
    <div className="topbar">
      <div className="header-left">
        <h1>Ghostkeys</h1>
        <div className="profile">
          <div className="profile-icon"></div>
          {profile?.nickname || "Anon"}
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
