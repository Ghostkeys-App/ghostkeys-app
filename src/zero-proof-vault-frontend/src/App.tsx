import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./pages/app-shell/AppShell.tsx";
import WebsiteLogins from "./pages/website-logins/WebsiteLogins.tsx";
import SecurityNotes from "./pages/security-notes/SecurityNotes.tsx";
import SpreadsheetCanvas from "./pages/spreadsheet/Spreadsheet.tsx";
import { IdpPopup } from "./utility/identity/IdpPopup.tsx";
import SettingsOverlay from "./components/settings/SettingsOverlay.tsx";

export default function App() {
  return (
    <Router>
      <Routes>
        {/* IFrame logic with popup */}
        <Route path="/idp/popup" element={<IdpPopup />} />
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/website-logins" replace />} />
          <Route path="/spreadsheet" element={<SpreadsheetCanvas />} />
          <Route path="/website-logins" element={<WebsiteLogins />} />
          <Route path="/security-notes" element={<SecurityNotes />} />
          {/* Settings overlay routes */}
          <Route path="/settings/*" element={<SettingsOverlay />} />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/website-logins" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}
