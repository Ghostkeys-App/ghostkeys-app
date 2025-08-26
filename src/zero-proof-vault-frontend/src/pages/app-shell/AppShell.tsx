import "../../styles/theme.scss";
import TemplateSidebar from "../../components/sidebar/NewSidebar.tsx";
import React from "react";
import {Outlet, useLocation, useNavigate} from "react-router-dom";
import {pathToKey, ROUTES} from "./constants.tsx";

export default function AppShell() {
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
