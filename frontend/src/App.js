import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import LandingPage from "@/components/LandingPage";
import Dashboard from "@/components/Dashboard";
import AllergyProfileSetup from "@/components/AllergyProfileSetup";
import ScanProduct from "@/components/ScanProduct";
import History from "@/components/History";
import { Toaster } from "@/components/ui/sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (token) {
      const userData = localStorage.getItem("user");
      if (userData) {
        setUser(JSON.parse(userData));
      }
    }
  }, [token]);

  const handleAuth = (authToken, userData) => {
    localStorage.setItem("token", authToken);
    localStorage.setItem("user", JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              token ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <LandingPage onAuth={handleAuth} />
              )
            }
          />
          <Route
            path="/dashboard"
            element={
              token ? (
                <Dashboard user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/profile-setup"
            element={
              token ? (
                <AllergyProfileSetup user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/scan"
            element={
              token ? (
                <ScanProduct user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/history"
            element={
              token ? (
                <History user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;