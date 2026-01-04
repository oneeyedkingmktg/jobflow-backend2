import React, { useState, useRef, useEffect } from 'react';
import { useCompany } from './CompanyContext';

export default function CompanySwitcher() {
  const { currentCompany, companies, switchCompany } = useCompany();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitch = (companyId) => {
    switchCompany(companyId);
    setIsOpen(false);
  };

  if (!currentCompany) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
      >
        <span className="text-white font-semibold text-sm">{currentCompany.name}</span>
        <span className="text-white text-xs">▼</span>
      </button>

      {isOpen && companies.length > 1 && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50 animate-fade-in">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-600 uppercase">Switch Company</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => handleSwitch(company.id)}
                className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                  currentCompany.id === company.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{company.name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{company.ownerName}</p>
                  </div>
                  {currentCompany.id === company.id && (
                    <span className="text-blue-600 font-bold text-lg">✓</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}