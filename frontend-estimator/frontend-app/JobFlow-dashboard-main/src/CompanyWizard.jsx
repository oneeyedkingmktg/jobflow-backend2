import React, { useState } from 'react';
import { useCompany } from './CompanyContext';
import { useAuth } from './AuthContext';

export default function CompanyWizard({ onComplete, onCancel }) {
  const { createCompany, switchCompany } = useCompany();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  });

  const [error, setError] = useState('');

  // Only Master can create a company
  if (user?.role !== 'master') {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
          <h2 className="text-xl font-bold mb-4">Permission Denied</h2>
          <p className="text-gray-600 mb-6">
            Only master users can create a new company.
          </p>
          <button
            onClick={onCancel}
            className="w-full px-6 py-3 bg-gray-700 text-white rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const nextStep = () => {
    if (step === 1 && !formData.name.trim()) {
      setError('Company name is required');
      return;
    }
    setError('');
    setStep(step + 1);
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  // CREATE COMPANY USING BACKEND
  const handleCreate = async () => {
    setSaving(true);
    setError('');

    try {
      const result = await createCompany(formData);

      if (!result.success) {
        throw new Error(result.error || 'Failed to create company');
      }

      // Switch to new company automatically
      await switchCompany(result.company.id);

      onComplete();
    } catch (err) {
      setError(err.message || 'Failed to create company');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8">

        {/* HEADER */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-t-2xl">
          <h2 className="text-2xl font-bold text-white">New Company Setup</h2>
          <p className="text-blue-100 text-sm mt-1">Step {step} of 2</p>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-6">

          {/* ERROR */}
          {error && (
            <div className="p-3 bg-red-50 border-l-4 border-red-600 text-red-800 rounded">
              {error}
            </div>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Company Information
              </h3>

              <div>
                <label className="font-semibold text-gray-700 mb-1 block">
                  Company Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg"
                  placeholder="ProShield Floors"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 mb-1 block">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg"
                  placeholder="company@email.com"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 mb-1 block">
                  Phone
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg"
                  placeholder="555-123-4567"
                />
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Location Details
              </h3>

              <div>
                <label className="font-semibold text-gray-700 mb-1 block">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg h-28"
                  placeholder="123 Main St..."
                ></textarea>
              </div>
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div className="flex gap-3 pt-6 border-t">

            {step > 1 && (
              <button
                onClick={prevStep}
                className="flex-1 px-6 py-3 bg-gray-500 text-white rounded-xl"
              >
                Back
              </button>
            )}

            <button
              onClick={onCancel}
              className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-xl"
            >
              Cancel
            </button>

            {step === 1 ? (
              <button
                onClick={nextStep}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
              >
                {saving ? 'Creating...' : 'Create Company'}
              </button>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
