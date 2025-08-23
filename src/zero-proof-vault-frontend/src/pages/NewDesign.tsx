import "../styles/theme.scss";
import TemplateSidebar, {TemplateKey} from "../components/new-design/NewSidebar.tsx";
import React from "react";
import {Outlet, useLocation, useNavigate} from "react-router-dom";

const ROUTES: Record<TemplateKey, string> = {
  logins: "/website-logins",
  notes: "/security-notes",
  grid: "/spreadsheet",
};
const pathToKey = (p: string): TemplateKey =>
    p.startsWith("/security-notes") ? "notes" :
        p.startsWith("/spreadsheet")   ? "grid"   : "logins";

export default function NewDesign() {
  const location = useLocation();
  const navigate = useNavigate();
  const selected = pathToKey(location.pathname);

  return (
      <div className="main-content">
        <TemplateSidebar
            selected={selected}
            onSelect={(key) => navigate(ROUTES[key])}
        />
        <div style={{flex: 1, minWidth: 0, position: 'relative'}}>
          <div className="main-bg"/>
          <Outlet/>
        </div>
      </div>
  );
}
