// ============================================================================
// File: src/users/UserPermissionsModal.jsx
// Phase 1 — Financial Information permission only.
// Additional categories are shown as coming-soon to establish the structure.
// ============================================================================

import React, { useState } from 'react';
import { UsersAPI } from '../api';

const LEVELS = ['hide', 'view', 'edit'];

const CATEGORIES = [
  {
    key: 'financial_information',
    label: 'Financial Information',
    description: 'Contract price, bid totals, payment schedule, Create Documents',
    active: true,
  },
  {
    key: 'lead_management',
    label: 'Lead Management',
    description: 'Status changes, pause, mark as junk, delete contact',
    active: false,
  },
  {
    key: 'bidder',
    label: 'Bidder',
    description: 'View and edit bids',
    active: false,
  },
  {
    key: 'contact_editing',
    label: 'Contact Editing',
    description: 'Edit contact fields, photos, files',
    active: false,
  },
  {
    key: 'customer_communications',
    label: 'Customer Communications',
    description: 'Message history and sending',
    active: false,
  },
  {
    key: 'calendar',
    label: 'Calendar',
    description: 'View and edit appointments',
    active: false,
  },
  {
    key: 'service_calls',
    label: 'Service Calls',
    description: 'View and manage service calls',
    active: false,
  },
  {
    key: 'reports',
    label: 'Reports',
    description: 'Access to the Reports tab',
    active: false,
  },
];

export default function UserPermissionsModal({ user, onClose, onSaved }) {
  const [permissions, setPermissions] = useState(user.permissions || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setLevel = (key, level) =>
    setPermissions((prev) => ({ ...prev, [key]: level }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await UsersAPI.updatePermissions(user.id, permissions);
      onSaved(permissions);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4">
          <h2 className="text-xl font-bold">Permissions</h2>
          <p className="text-blue-200 text-sm mt-0.5">{user.name || user.email}</p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-600 p-3 text-red-800 text-sm">
              {error}
            </div>
          )}

          {CATEGORIES.map((cat) => {
            const current = permissions[cat.key] ?? 'hide';
            return (
              <div
                key={cat.key}
                className={`border rounded-xl p-4 ${cat.active ? 'border-gray-200' : 'border-gray-100 opacity-50'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 text-sm">{cat.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{cat.description}</div>
                    {!cat.active && (
                      <div className="text-xs text-blue-500 font-medium mt-1">Coming soon</div>
                    )}
                  </div>

                  {cat.active ? (
                    <div className="flex gap-1 shrink-0">
                      {LEVELS.map((level) => (
                        <button
                          key={level}
                          onClick={() => setLevel(cat.key, level)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                            current === level
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300 shrink-0">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 font-semibold hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      </div>
    </div>
  );
}
