// ============================================================================
// File: src/leadModalParts/BidderPanel.jsx
// Bid selection screen + container — opened from LeadDetailsView
// ============================================================================

import React, { useEffect, useState } from 'react';
import { BidderAPI } from '../api';
import BidderForm from './BidderForm';
import { useAuth } from '../AuthContext';
import { usePermission } from '../utils/usePermission';

const STATUS_COLORS = {
  pending:  { bg: 'bg-yellow-50', border: 'border-yellow-300', badge: 'bg-yellow-100 text-yellow-800' },
  accepted: { bg: 'bg-green-50',  border: 'border-green-300',  badge: 'bg-green-100 text-green-800'   },
};

const STATUS_LABELS = {
  pending:  'Pending',
  accepted: 'Accepted',
};

function fmt(val) {
  const n = parseFloat(val);
  return isNaN(n) ? '$0.00' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// job prop is optional — when provided, bids are scoped to that job
export default function BidderPanel({ lead, job, onClose }) {
  const { user } = useAuth();
  const financialPermission = usePermission('financial_information');
  const [bids, setBids]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [creating, setCreating]   = useState(false);
  const [activeBidId, setActiveBidId] = useState(null); // null = list view

  useEffect(() => {
    loadBids();
  }, []);

  async function loadBids() {
    setLoading(true);
    try {
      const data = job
        ? await BidderAPI.getProposalsByJob(job.id)
        : await BidderAPI.getProposals(lead.id);
      setBids(data);
    } catch (e) {
      console.error('Failed to load bids', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleNewBid() {
    setCreating(true);
    try {
      const proposal = await BidderAPI.createProposal({
        lead_id: lead.id,
        ...(job ? { job_id: job.id } : {}),
        company_id: lead.companyId,
        bid_name: `Bid ${bids.length + 1}`,
        status: 'pending',
        salesman: user?.name || user?.email || '',
      });
      setActiveBidId(proposal.id);
    } catch (e) {
      alert('Failed to create bid');
    } finally {
      setCreating(false);
    }
  }

  function handleBidBack() {
    setActiveBidId(null);
    loadBids();
  }

  // ── Bid Form view ──────────────────────────────────────────────────────────
  if (activeBidId !== null) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] px-2 pt-2 pb-20">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[calc(100vh-96px)] flex flex-col overflow-x-hidden">
          <BidderForm
            proposalId={activeBidId}
            lead={lead}
            onBack={handleBidBack}
            onClose={onClose}
          />
        </div>
      </div>
    );
  }

  // ── Selection screen ───────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Bids</h2>
            <p className="text-blue-200 text-sm">
              {job ? job.jobName : (lead.name || lead.fullName)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleNewBid}
              disabled={creating}
              className="px-4 py-2 bg-white text-blue-600 font-semibold text-sm rounded-lg hover:bg-blue-50 disabled:opacity-50"
            >
              {creating ? 'Creating…' : '+ New Bid'}
            </button>
            <button onClick={onClose} className="text-blue-200 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Bid list */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-8">Loading bids…</p>
          ) : bids.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-2">No bids yet for this contact.</p>
              <button
                onClick={handleNewBid}
                disabled={creating}
                className="mt-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating…' : '+ Create First Bid'}
              </button>
            </div>
          ) : (
            bids.map((bid) => {
              const colors = STATUS_COLORS[bid.status] || STATUS_COLORS.pending;
              return (
                <button
                  key={bid.id}
                  onClick={() => setActiveBidId(bid.id)}
                  className={`w-full text-left border-2 rounded-xl px-5 py-4 transition hover:shadow-md ${colors.bg} ${colors.border}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                          {STATUS_LABELS[bid.status] || bid.status}
                        </span>
                        {bid.status === 'accepted' && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                            Signed
                          </span>
                        )}
                        {bid.paid_at && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-600 text-white">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Down Paid
                          </span>
                        )}
                        {bid.final_paid_at && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-600 text-white">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                            Paid in Full
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-gray-900 text-base truncate">{bid.bid_name}</p>
                      {bid.bid_description && (
                        <p className="text-sm text-gray-600 mt-0.5 truncate">{bid.bid_description}</p>
                      )}
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        {bid.presented_date && <span>Presented {fmtDate(bid.presented_date)}</span>}
                        {bid.accepted_date && bid.status === 'accepted' && (
                          <span className="text-green-700 font-medium">Accepted {fmtDate(bid.accepted_date)}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {financialPermission !== 'hide' && (
                        <p className="text-xl font-bold text-gray-900">{fmt(bid.bid_total)}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
