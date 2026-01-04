// ============================================================================
// File: src/SettingsMenu.jsx
// Version: v1.3.6 – Added My Profile save/delete handlers + phone formatting
// ============================================================================

import React, { useState } from "react";
import { useCompany } from "./CompanyContext";
import { useAuth } from "./AuthContext";
import { UsersAPI } from "./api";
import SettingsModal from "./SettingsModal";
import CompanyWizard from "./CompanyWizard";
import UserProfileModal from "./UserProfileModal";

// IMPORT SCREENS
import UsersHome from "./users/UsersHome";

// Format phone: (555) 555-5555
const formatPhone = (phone) => {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
};

export default function SettingsMenu() {
  const { companies, switchCompany, currentCompany } = useCompany();
  const { user, isMaster, logout } = useAuth();

  const [showMenu, setShowMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCompanyWizard, setShowCompanyWizard] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showUserMgmt, setShowUserMgmt] = useState(false);

  // 🔒 CRITICAL: normalize isMaster safely
  const isMasterUser =
    typeof isMaster === "function" ? isMaster() : Boolean(isMaster);

  const isAdmin = user?.role === "admin";
  const isRegularUser = user?.role === "user";

  const handleSwitchCompany = (e) => {
    const companyId = parseInt(e.target.value, 10);
    switchCompany(companyId);
  };

  const handleManageCompanies = () => {
    setShowMenu(false);
    if (window.__setAppScreen) {
      window.__setAppScreen("companies");
    }
  };

  const handleManageUsers = () => {
    setShowMenu(false);
    setShowUserMgmt(true);
  };

  const handleCompanySettings = () => {
    setShowMenu(false);
    setShowSettings(true);
  };

  const handleMyProfile = () => {
    setShowMenu(false);
    setShowUserProfile(true);
  };

  const handleLogout = () => {
    setShowMenu(false);
    logout();
  };

  // Save user profile
  const handleSaveProfile = async (updates) => {
    try {
      // Format phone before saving
      const formattedUpdates = {
        ...updates,
        phone: formatPhone(updates.phone),
      };

      await UsersAPI.update(user.id, formattedUpdates);
      
      // Refresh page to reload user data
      window.location.reload();
    } catch (error) {
      console.error("Failed to update profile:", error);
      alert("Failed to save profile. Please try again.");
    }
  };

  // Delete user (shouldn't be used for own profile, but included for safety)
  const handleDeleteProfile = async (userToDelete) => {
    if (userToDelete.id === user.id) {
      alert("You cannot delete your own account.");
      return;
    }

    if (!confirm("Are you sure you want to delete this user?")) {
      return;
    }

    try {
      await UsersAPI.delete(userToDelete.id);
      setShowUserProfile(false);
    } catch (error) {
      console.error("Failed to delete user:", error);
      alert("Failed to delete user. Please try again.");
    }
  };

  return (
    <>
      {/* Gear Icon */}
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="touch-target p-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95"
          aria-label="Menu"
        >
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>

        {/* Dropdown */}
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />

            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl z-50 overflow-hidden border border-gray-200">
              {/* MASTER MENU */}
              {isMasterUser && (
                <>
                  <div className="bg-gray-600 px-6 py-4">
                    <label className="block text-xs font-semibold text-white uppercase tracking-wide mb-2">
                      Current Company
                    </label>
                    <select
                      value={currentCompany?.id || ""}
                      onChange={handleSwitchCompany}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 font-semibold"
                    >
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-4 space-y-2">
                    <button 
                      onClick={handleManageCompanies} 
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition"
                    >
                      Manage Companies
                    </button>
                    <button 
                      onClick={handleManageUsers} 
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition"
                    >
                      Manage Users
                    </button>
                    <button 
                      onClick={handleMyProfile} 
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition"
                    >
                      My Profile
                    </button>
                    <button 
                      onClick={handleLogout} 
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-red-600 font-medium hover:bg-red-50 transition"
                    >
                      Logout
                    </button>
                  </div>
                </>
              )}

              {/* ADMIN MENU */}
              {isAdmin && !isMasterUser && (
                <div className="p-4 space-y-2">
                  <button 
                    onClick={handleCompanySettings} 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition"
                  >
                    Company Settings
                  </button>
                  <button 
                    onClick={handleMyProfile} 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition"
                  >
                    My Profile
                  </button>
                  <button 
                    onClick={handleLogout} 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-red-600 font-medium hover:bg-red-50 transition"
                  >
                    Logout
                  </button>
                </div>
              )}

              {/* USER MENU */}
              {isRegularUser && !isAdmin && !isMasterUser && (
                <div className="p-4 space-y-2">
                  <button 
                    onClick={handleMyProfile} 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition"
                  >
                    My Profile
                  </button>
                  <button 
                    onClick={handleLogout} 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-red-600 font-medium hover:bg-red-50 transition"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* MODALS */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showCompanyWizard && (
        <CompanyWizard
          onComplete={() => setShowCompanyWizard(false)}
          onCancel={() => setShowCompanyWizard(false)}
        />
      )}
      {showUserProfile && (
        <UserProfileModal 
          currentUser={user}
          onSave={handleSaveProfile}
          onDelete={handleDeleteProfile}
          onClose={() => setShowUserProfile(false)} 
        />
      )}

      {/* FULL PAGE PANELS */}
      {showUserMgmt && (
        <div className="fixed inset-0 bg-black/30 z-50 flex">
          <div className="flex-1 bg-white overflow-auto">
            <UsersHome showAllUsers />
          </div>
          <button
            onClick={() => setShowUserMgmt(false)}
            className="absolute top-4 right-4 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
          >
            Close
          </button>
        </div>
      )}
    </>
  );
}