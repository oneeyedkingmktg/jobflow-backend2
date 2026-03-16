// File: src/App.jsx
// Version: v1.1.2 – Added password reset token detection

import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { CompanyProvider, useCompany } from "./CompanyContext";
import Login from "./Login";
import ForgotPassword from "./ForgotPassword";
import ResetPassword from "./ResetPassword";
import LeadsHome from "./LeadsHome.jsx";
import CompaniesHome from "./company/CompaniesHome.jsx";
import MessagesPage from "./pages/MessagesPage.jsx";
import "./index.css";
import { initializePushNotifications, setupPushListeners } from "./services/pushNotificationService";
import { StatusBar, Style } from "@capacitor/status-bar";
import { isNativeApp } from "./utils/platform";

// Register push listeners immediately at module load — before React renders
setupPushListeners();

// Fix Capacitor 6 edge-to-edge: prevent status bar from overlapping WebView content
if (isNativeApp()) {
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  StatusBar.setBackgroundColor({ color: "#225ce5" }).catch(() => {});
}

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
function LockedScreen({ children }) {
  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none select-none opacity-30">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 z-10">
        <div className="bg-white rounded-2xl shadow-xl p-8 mx-6 text-center max-w-sm">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Pro Feature</h2>
          <p className="text-gray-600 text-sm">
            Upgrade to CoatingPro360 Pro to unlock the full CRM, messaging, calendar, and more.
          </p>
          <p className="text-gray-500 text-xs mt-3">
            Contact us to upgrade your plan.
          </p>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { currentCompany, companies, loading: companyLoading } = useCompany();

  // App-level screen control (default = leads)
  const [activeScreen, setActiveScreen] = useState("leads");
  const [totalUnread, setTotalUnread] = useState(0);

  const isEstimatorOnly = user?.planType === 'estimator_only';

  // Detect reset token in URL and show reset password screen
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setActiveScreen("reset-password");
    }
  }, []);

  // Initialize push notifications when user logs in
  useEffect(() => {
    if (isAuthenticated && user) {
      initializePushNotifications(user);
    }
  }, [isAuthenticated, user]);

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
     2. Login / Password Reset screens
     --------------------------------------- */
  if (!isAuthenticated || !user) {
    if (activeScreen === "forgot-password") {
      return <ForgotPassword onBack={() => setActiveScreen("login")} />;
    }
    if (activeScreen === "reset-password") {
      return <ResetPassword onBack={() => setActiveScreen("login")} />;
    }
    return <Login onForgotPassword={() => setActiveScreen("forgot-password")} />;
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
    <div className="min-h-screen bg-gray-50 pb-16">
      {activeScreen === "messages" ? (
        isEstimatorOnly ? (
          <LockedScreen><MessagesPage onUnreadCount={setTotalUnread} /></LockedScreen>
        ) : (
          <MessagesPage onUnreadCount={setTotalUnread} />
        )
      ) : (
        <LeadsHome currentUser={user} />
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex">
        <button
          onClick={() => setActiveScreen("leads")}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 text-xs font-medium transition-colors ${
            activeScreen === "leads" ? "text-blue-600" : "text-gray-500"
          }`}
        >
          {/* Person icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={activeScreen === "leads" ? 2.5 : 1.8}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"
            />
          </svg>
          Leads
        </button>

        <button
          onClick={() => setActiveScreen("messages")}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 text-xs font-medium transition-colors relative ${
            activeScreen === "messages" ? "text-blue-600" : "text-gray-500"
          }`}
        >
          {/* Speech bubble icon */}
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={activeScreen === "messages" ? 2.5 : 1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 10h.01M12 10h.01M16 10h.01M21 16a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v11z"
              />
            </svg>
            {totalUnread > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </div>
          Messages
        </button>
      </nav>
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