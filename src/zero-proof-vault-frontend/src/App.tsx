import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import ManageVault from "./pages/ManageVault";
import NewDesign from "./pages/NewDesign.tsx";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<NewDesign />} />
        <Route path="/manage" element={<ManageVault />} />
      </Routes>
    </Router>
  );
}
