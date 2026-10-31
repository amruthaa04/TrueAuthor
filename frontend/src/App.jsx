import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Marketplace from "./pages/Marketplace";
import Verify from "./pages/Verify";
import Profile from "./pages/Profile";
import SavedWorks from "./pages/SavedWorks";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/upload" element={<Upload />} />
      <Route path="/marketplace" element={<Marketplace />} />
      <Route path="/verify" element={<Verify />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/saved" element={<SavedWorks />} />
    </Routes>
  );
}

export default App;