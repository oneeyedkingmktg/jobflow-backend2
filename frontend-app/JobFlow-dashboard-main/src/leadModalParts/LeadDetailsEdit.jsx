import React from "react";

export default function LeadDetailsEdit({ form, onChange, onPhoneChange }) {
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
          className="w-full mt-1 px-3 py-2 border rounded-lg"
        />
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

      {/* COMPANY NAME */}
      <div>
        <label className="text-gray-500">Company Name</label>
        <input
          type="text"
          value={form.companyName}
          onChange={(e) => onChange("companyName", e.target.value)}
          className="w-full mt-1 px-3 py-2 border rounded-lg"
        />
      </div>

      {/* PROJECT TYPE */}
      <div>
        <label className="text-gray-500">Project Type</label>
        <input
          type="text"
          value={form.projectType}
          onChange={(e) => onChange("projectType", e.target.value)}
          className="w-full mt-1 px-3 py-2 border rounded-lg"
        />
      </div>

      {/* CONTRACT PRICE */}
      <div>
        <label className="text-gray-500">Contract Price</label>
        <input
          type="number"
          value={form.contractPrice}
          onChange={(e) => onChange("contractPrice", e.target.value)}
          className="w-full mt-1 px-3 py-2 border rounded-lg"
        />
      </div>

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
