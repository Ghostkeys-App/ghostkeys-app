import React from "react";
import {BrowserRouter as Router, Routes, Route, Navigate} from "react-router-dom";
import NewDesign from "./pages/NewDesign.tsx";
import WebsiteLogins from "./components/new-design/WebsiteLogins.tsx";
import SecureNotes from "./components/new-design/SecureNotes.tsx";
import Spreadsheet from "./components/new-design/Spreadsheet.tsx";
import {useIdentitySystem} from "./utility/identity";
import {ghostkeysStorage} from "./storage/IDBService.ts";
import {mockApi} from "./api/APIService.ts";

export default function App() {
  const { currentProfile } = useIdentitySystem();
  const id = currentProfile.principal.toString();
  const currentVaultId = "default";

  React.useEffect(() => {
    (async () => {
      const row = await ghostkeysStorage.getVault(id, currentVaultId);

      if (row) {
        console.log('exists', row)
      } else {
        const serverVaults = await mockApi.get_all_vaults_for_user(id);
        await ghostkeysStorage.applyServerPayload(id, serverVaults);

        const row = await ghostkeysStorage.getVault(id, currentVaultId);
        console.log('loaded', row)
      }
    })();
  }, []);

  return (
    <Router>
      <Routes>
        <Route element={<NewDesign />}>
          <Route index element={<Navigate to="/spreadsheet" replace />} />
          <Route path="/spreadsheet" element={<Spreadsheet />} />
          <Route path="/website-logins" element={<WebsiteLogins />} />
          <Route path="/security-notes" element={<SecureNotes />} />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/website-logins" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}
