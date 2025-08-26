import React from "react";
import {BrowserRouter as Router, Routes, Route, Navigate} from "react-router-dom";
import NewDesign from "./pages/NewDesign.tsx";
import WebsiteLogins from "./components/website-logins/WebsiteLogins.tsx";
import SecurityNotes from "./components/security-notes/SecurityNotes.tsx";
import SpreadsheetCanvas from "./components/spreadsheet/Spreadsheet.tsx";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<NewDesign />}>
          <Route index element={<Navigate to="/website-logins" replace />} />
          <Route path="/spreadsheet" element={<SpreadsheetCanvas />} />
          <Route path="/website-logins" element={<WebsiteLogins />} />
          <Route path="/security-notes" element={<SecurityNotes />} />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/website-logins" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}
