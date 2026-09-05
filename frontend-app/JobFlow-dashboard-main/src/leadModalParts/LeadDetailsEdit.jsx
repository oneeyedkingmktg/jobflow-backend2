import React from "react";
import { usePermission } from "../utils/usePermission";
import { useCompany } from "../CompanyContext";

export default function LeadDetailsEdit({ form, onChange, onPhoneChange, onPhoneBlur, phoneWarning }) {
  const financialPermission = usePermission('financial_information');
  const { currentCompany } = useCompany();
  const jobsEnabled = !!(currentCompany?.jobsEnabled ?? currentCompany?.jobs_enabled);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 px-5 py-5 shadow-sm space-y-4 text-sm text-gray-800">

      {/* NAME */}
      <div>
        <label className="text-gray-500">Full Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => onChange("name", e.target.value)}
          className="w-full mt-1 px-3 py-2 border rounded-lg"
        />
      </div>

      {/* EMAIL */}
      <div>
        <label className="text-gray-500">Email</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => onChange("email", e.target.value)}
          className="w-full mt-1 px-3 py-2 border rounded-lg"
        />
      </div>

      {/* PHONE */}
      <div>
        <label className="text-gray-500">Phone</label>
        <input
          type="text"
          value={form.phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          onBlur={onPhoneBlur}
          className="w-full mt-1 px-3 py-2 border rounded-lg"
        />
        {phoneWarning && (
          <p className="mt-1 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {phoneWarning}
          </p>
        )}
      </div>

      {/* ADDRESS */}
      <div>
        <label className="text-gray-500">Address</label>
        <input
          type="text"
          value={form.address}
          onChange={(e) => onChange("address", e.target.value)}
          className="w-full mt-1 px-3 py-2 border rounded-lg"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-gray-500">City</label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => onChange("city", e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="text-gray-500">State</label>
          <input
            type="text"
            value={form.state}
            onChange={(e) => onChange("state", e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="text-gray-500">ZIP</label>
          <input
            type="text"
            value={form.zip}
  onChange={(e) => onChange("zip", e.target.value.replace(/\D/g, "").slice(0, 5))}
            className="w-full mt-1 px-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      {/* BUYER TYPE — UPDATED */}
      <div>
        <label className="text-gray-500">Buyer Type</label>
        <select
          value={form.buyerType}
          onChange={(e) => onChange("buyerType", e.target.value)}
          className="w-full mt-1 px-3 py-2 border rounded-lg bg-white"
        >
          <option value="">Select…</option>
          <option value="Residential">Residential</option>
          <option value="Small Business">Small Business</option>
          <option value="Commercial">Commercial</option>
          <option value="Competitive Bid">Competitive Bid</option>
        </select>
      </div>

{/* COMPANY NAME - only show if not Residential */}
      {form.buyerType !== "Residential" && (
        <div>
          <label className="text-gray-500">Company Name</label>
          <input
            type="text"
            value={form.companyName}
            onChange={(e) => onChange("companyName", e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded-lg"
          />
        </div>
      )}

      {/* PROJECT TYPE — hidden when jobs enabled (managed per-job instead) */}
      {!jobsEnabled && (
        <div>
          <label className="text-gray-500">Project Type</label>
          <input
            type="text"
            value={form.projectType}
            onChange={(e) => onChange("projectType", e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded-lg"
          />
        </div>
      )}

      {/* CONTRACT PRICE */}
      {financialPermission !== 'hide' && (
        <div>
          <label className="text-gray-500">Contract Price</label>
          {financialPermission === 'view' ? (
            <div className="w-full mt-1 px-3 py-2 bg-gray-50 text-gray-700 rounded-lg border border-gray-200">
              {form.contractPrice ? `$${Number(form.contractPrice).toLocaleString()}` : 'Not Set'}
            </div>
          ) : (
            <input
              type="number"
              value={form.contractPrice}
              onChange={(e) => onChange("contractPrice", e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          )}
        </div>
      )}

      {/* NOTES */}
      <div>
        <label className="text-gray-500">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => onChange("notes", e.target.value)}
          className="w-full mt-1 px-3 py-2 border rounded-lg h-28"
        ></textarea>
      </div>
    </div>
  );
}
