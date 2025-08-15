// NewDesign.tsx
import { useIdentitySystem } from "../utility/identity";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import "../styles/theme.scss";
import TemplateSidebar, {TemplateKey} from "../components/new-design/NewSidebar.tsx";
import React from "react";
import WebsiteLogins from "../components/new-design/WebsiteLogins.tsx";

export default function NewDesign() {
  const { currentProfile, currentVault } = useIdentitySystem();
  const [selected, setSelected] = React.useState<TemplateKey>("logins");

  return (
      <div className="vault-app">
        {/*<TopBar profile={currentProfile} selected={selected}/>*/}

        <div className="main-content">
          <TemplateSidebar selected={selected} onSelect={setSelected} profile={currentProfile}/>
          <WebsiteLogins/>
        </div>
      </div>
  );
}
