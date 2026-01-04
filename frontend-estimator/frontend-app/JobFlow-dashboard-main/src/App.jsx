// File: src/App.jsx
// Version: v1.1.1 – Bypass global loading gate for Companies screen (surgical)

import React, { useState } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { CompanyProvider, useCompany } from "./CompanyContext";
import Login from "./Login";
import LeadsHome from "./LeadsHome.jsx";
import CompaniesHome from "./company/CompaniesHome.jsx";
import "./index.css";

/* ===========================================================
   Error Boundary (Prevents React from white-screening)
   =========================================================== */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error.message || "Unknown error" };
  }

  componentDidCatch(error, info) {
    console.error("React ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50">
          <div className="p-8 bg-white rounded-xl shadow-xl max-w-lg">
            <h1 className="text-2xl font-bold text-red-600 mb-2">App Error</h1>
            <p className="text-gray-700 mb-4">{this.state.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/* ===========================================================
   MAIN APP CONTENT
   =========================================================== */
function AppContent() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { currentCompany, companies, loading: companyLoading } = useCompany();

  // App-level screen control (default = leads)
  const [activeScreen, setActiveScreen] = useState("leads");

  // Expose setter for admin navigation
  if (typeof window !== "undefined") {
    window.__setAppScreen = setActiveScreen;
  }

  // IMPORTANT:
  // Do NOT apply global loading gate when viewing Companies
  const fullyLoading =
    activeScreen !== "companies" && (isLoading || companyLoading);

  /* ---------------------------------------
     1. Global loading spinner
     --------------------------------------- */
  if (fullyLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading data...</p>
        </div>
      </div>
    );
  }

  /* ---------------------------------------
     2. Login screen
     --------------------------------------- */
  if (!isAuthenticated || !user) {
    return <Login />;
  }

  /* ---------------------------------------
     3. No company yet (master creating first company)
     --------------------------------------- */
  if (user.role === "master" && companies.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="p-8 bg-white rounded-xl shadow-lg max-w-lg">
          <h2 className="text-2xl font-bold mb-4">Welcome Master Admin</h2>
          <p className="text-gray-700 mb-6">
            You have no companies yet. Use the Settings menu to create the first one.
          </p>
        </div>
      </div>
    );
  }

  /* ---------------------------------------
     4. Company still loading / unavailable
     --------------------------------------- */
  if (!currentCompany && user.role !== "master") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-700">Preparing your company workspace…</p>
        </div>
      </div>
    );
  }

  /* ---------------------------------------
     5. Screen selection
     --------------------------------------- */
  if (activeScreen === "companies") {
    return (
      <div className="min-h-screen bg-gray-50">
        <CompaniesHome onBack={() => setActiveScreen("leads")} />
      </div>
    );
  }

  /* ---------------------------------------
     6. Main App (default)
     --------------------------------------- */
  return (
    <div className="min-h-screen bg-gray-50">
      <LeadsHome currentUser={user} />
    </div>
  );
}

/* ===========================================================
   APP PROVIDERS + ERROR BOUNDARY
   =========================================================== */
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CompanyProvider>
          <AppContent />
        </CompanyProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}