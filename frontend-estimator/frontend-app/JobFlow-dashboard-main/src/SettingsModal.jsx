// File: src/SettingsModal.jsx
// Version: v2.4 - Simplify My Profile rendering logic

import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import { useCompany } from "./CompanyContext";
import { UsersAPI } from "./api";

import CompanyManagement from "./CompanyManagement";
import CompanyDetails from "./CompanyDetails";
import CompanyModal from "./company/CompanyModal";
import UsersHome from "./users/UsersHome";
import UserProfileModal from "./UserProfileModal";

export default function SettingsModal({ onClose }) {
  const { logout, isMaster, user } = useAuth();
  const { currentCompany, updateCompany } = useCompany();

  const [screen, setScreen] = useState("home");
  const [selectedCompany, setSelectedCompany] = useState(null);

  const goHome = () => {
    setScreen("home");
    setSelectedCompany(null);
  };

  const openManageCompanies = () => setScreen("manage_companies");
  const openCompanyDetails = (company) => {
    setSelectedCompany(company);
    setScreen("company_details");
  };
  const openManageUsers = () => setScreen("manage_users");
  const openMyProfile = () => setScreen("my_profile");
  const openCompanySettings = () => setScreen("company_settings");
  const openSuperAdmin = () => setScreen("superadmin");

  const handleBack = () => {
    if (screen === "company_details") return setScreen("manage_companies");
    if (screen !== "home") return goHome();
    onClose();
  };

  // Handle saving company for admin
  const handleSaveCompany = async (formData) => {
    try {
      console.log("SettingsModal saving company:", formData);
      await updateCompany(currentCompany.id, formData);
      console.log("Company saved successfully");
    } catch (err) {
      console.error("Failed to save company:", err);
      throw err;
    }
  };

  // Handle saving user profile
  const handleSaveProfile = async (formData) => {
    try {
      console.log("SettingsModal saving user profile:", formData);
      await UsersAPI.update(user.id, formData);
      console.log("Profile saved successfully");
      // Optionally refresh user data here
    } catch (err) {
      console.error("Failed to save profile:", err);
      throw err;
    }
  };

  // Handle deleting user (shouldn't delete own account)
  const handleDeleteUser = (userToDelete) => {
    if (userToDelete.id === user.id) {
      alert("You cannot delete your own account");
      return;
    }
    // This shouldn't happen for "My Profile" but keep it safe
    alert("Cannot delete user from profile view");
  };

  const renderHome = () => (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 mb-3">
        Settings & Administration
      </h2>

      <div className="space-y-3">
        {isMaster() && (
          <button
            onClick={openManageCompanies}
            className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
          >
            Manage Companies
          </button>
        )}

        {isMaster() && (
          <button
            onClick={openManageUsers}
            className="w-full px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
          >
            Manage Users
          </button>
        )}

        {isMaster() && (
          <button
            onClick={openSuperAdmin}
            className="w-full px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
          >
            Super Admin Details
          </button>
        )}

        {!isMaster() && (
          <button
            onClick={openCompanySettings}
            className="w-full px-6 py-4 bg-gray-700 hover:bg-gray-800 text-white font-bold rounded-xl"
          >
            Company Settings
          </button>
        )}

        <button
          onClick={openMyProfile}
          className="w-full px-6 py-4 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl"
        >
          My Profile
        </button>

        <button
          onClick={logout}
          className="w-full px-6 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl"
        >
          Logout
        </button>
      </div>

      {currentCompany && (
        <p className="mt-4 text-sm text-gray-500">
          Active company:{" "}
          <span className="font-semibold">
            {currentCompany.company_name || currentCompany.name}
          </span>
        </p>
      )}
    </div>
  );

  let content = null;

  switch (screen) {
    case "home":
      content = renderHome();
      break;

    case "manage_companies":
      content = (
        <CompanyManagement
          onClose={handleBack}
          onSelectCompany={openCompanyDetails}
        />
      );
      break;

    case "company_details":
      content = (
        <CompanyDetails
          company={selectedCompany}
          onBack={handleBack}
          onSave={() => {}}
        />
      );
      break;

    case "manage_users":
      content = <UsersHome onBack={handleBack} />;
      break;

    case "my_profile":
      // Handled in return statement to avoid nested modals
      content = null;
      break;

    case "company_settings":
      content = (
        <CompanyModal
          mode="edit"
          company={currentCompany}
          onClose={handleBack}
          onSave={handleSaveCompany}
        />
      );
      break;

    case "superadmin":
      content = (
        <div className="p-6">
          <p className="text-lg text-gray-700">Super Admin Details Coming Soon…</p>
          <button
            onClick={handleBack}
            className="mt-4 px-4 py-2 bg-gray-700 text-white rounded-lg"
          >
            Back
          </button>
        </div>
      );
      break;

    default:
      content = renderHome();
  }

  return (
    <>
      {screen === "my_profile" ? (
        user ? (
          <UserProfileModal
            user={user}
            currentUser={user}
            onClose={handleBack}
            onSave={handleSaveProfile}
            onDelete={handleDeleteUser}
          />
        ) : (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[999]">
            <div className="bg-white rounded-2xl shadow-2xl p-8">
              <p className="text-gray-600">Loading profile...</p>
            </div>
          </div>
        )
      ) : (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[999] p-4 overflow-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-auto">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
