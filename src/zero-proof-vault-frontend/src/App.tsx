import {BrowserRouter as Router, Routes, Route, Navigate} from "react-router-dom";
import Home from "./pages/Home";
import ManageVault from "./pages/ManageVault";
import NewDesign from "./pages/NewDesign.tsx";
import WebsiteLogins from "./components/new-design/WebsiteLogins.tsx";
import SecureNotes from "./components/new-design/SecureNotes.tsx";
import Spreadsheet from "./components/new-design/Spreadsheet.tsx";

export default function App() {
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
