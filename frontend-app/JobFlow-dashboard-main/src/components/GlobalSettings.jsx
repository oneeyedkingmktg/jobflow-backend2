// ============================================================================
// File: src/components/GlobalSettings.jsx
// Master-only: Global Settings modal with sub-tabs
// ============================================================================

import React, { useState } from 'react';
import BidderMasterAdmin from './BidderMasterAdmin';
import BidderSuppliers from './BidderSuppliers';

const TABS = [
  { key: 'proposal-design', label: 'Proposal Design' },
  { key: 'bidder-suppliers', label: 'Bidder Suppliers' },
];

export default function GlobalSettings({ onBack }) {
  const [activeTab, setActiveTab] = useState('proposal-design');

  return (
    <div className="flex flex-col max-h-[90vh]">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-0 shrink-0">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-800">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Global Settings</h2>
          <p className="text-sm text-gray-500">Master account configuration</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-6 pt-4 border-b border-gray-200 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'proposal-design' && (
          <BidderMasterAdmin embedded />
        )}
        {activeTab === 'bidder-suppliers' && (
          <BidderSuppliers />
        )}
      </div>
    </div>
  );
}
