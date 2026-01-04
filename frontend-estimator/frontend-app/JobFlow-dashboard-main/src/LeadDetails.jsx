import React, { useMemo, useState } from "react";

export default function LeadDetails({
  form,
  isEditing,
  formatDate,
  formatTime,
  setShowApptModal,
  setShowDateModal,
}) {
  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState("");
  const [estimate, setEstimate] = useState(null);

  const hasEstimate = form?.hasEstimate === true;

  const projectTypeLabel = (type) => {
    const map = {
      garage_1: "1 Car Garage",
      garage_2: "2 Car Garage",
      garage_3: "3 Car Garage",
      garage_4: "4 Car Garage",
      patio: "Patio",
      driveway: "Driveway",
      basement: "Basement",
      commercial: "Commercial",
      custom: "Custom",
    };
    if (!type) return "Unknown";
    return map[type] || type;
  };

  const money = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return "—";
    return `$${Math.round(num).toLocaleString()}`;
  };

  const parseRanges = (val) => {
    if (!val) return null;
    if (typeof val === "object") return val;
    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  };

  const computed = useMemo(() => {
    const ranges = parseRanges(estimate?.all_price_ranges);
    const flake = ranges?.flake || null;
    const solid = ranges?.solid || null;
    const metallic = ranges?.metallic || null;

    const sf = estimate?.calculated_sf ?? estimate?.calculatedSf ?? null;
    const length = estimate?.length_ft ?? estimate?.lengthFt ?? null;
    const width = estimate?.width_ft ?? estimate?.widthFt ?? null;

    const condition =
      estimate?.condition ?? estimate?.concrete_condition ?? null;

    const existingCoating =
      estimate?.existing_coating ??
      estimate?.existingCoating ??
      null;

    const minimumJobApplied =
      estimate?.minimum_job_applied ??
      estimate?.minimumJobApplied ??
      null;

    const createdAt = estimate?.created_at ?? estimate?.createdAt ?? null;

    return {
      ranges: { flake, solid, metallic },
      sf,
      length,
      width,
      condition,
      existingCoating,
      minimumJobApplied,
      createdAt,
      projectType: estimate?.project_type ?? estimate?.projectType ?? null,
    };
  }, [estimate]);

  const openEstimate = async () => {
    setEstimateError("");
    setShowEstimateModal(true);

    // If we already loaded it once, don't refetch
    if (estimate) return;

    setEstimateLoading(true);

    try {
      // We expect the backend to expose an endpoint for a lead's first saved estimate.
      // This is intentionally read-only.
      const token = localStorage.getItem("authToken");

      const res = await fetch(`/estimator/lead/${form.id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        let msg = "Failed to load estimate.";
        try {
          const j = await res.json();
          msg = j?.error || j?.message || msg;
        } catch {}
        throw new Error(msg);
      }

      const data = await res.json();

      // Accept flexible shapes:
      // { estimate: {...} } OR {...estimate}
      const est = data?.estimate || data;
      setEstimate(est);
    } catch (e) {
      setEstimateError(e?.message || "Failed to load estimate.");
    } finally {
      setEstimateLoading(false);
    }
  };

  const closeEstimate = () => setShowEstimateModal(false);

  const renderSizeLine = () => {
    const sf = computed.sf;

    // If dims exist, show dims + sf
    if (computed.length && computed.width) {
      const l = Number(computed.length);
      const w = Number(computed.width);
      const dimsOk = Number.isFinite(l) && Number.isFinite(w);

      if (dimsOk) {
        return (
          <p className="text-gray-700 text-sm">
            <span className="font-semibold">Size:</span>{" "}
            {l} ft × {w} ft
            {sf ? ` (${Number(sf).toLocaleString()} sf)` : ""}
          </p>
        );
      }
    }

    // Otherwise show sf only
    return (
      <p className="text-gray-700 text-sm">
        <span className="font-semibold">Size:</span>{" "}
        {sf ? `${Number(sf).toLocaleString()} sf` : "—"}
      </p>
    );
  };

  const renderRangeRow = (label, obj) => {
    const min = obj?.min;
    const max = obj?.max;

    return (
      <div className="flex items-center justify-between py-2 border-b border-gray-100">
        <div className="text-gray-800 font-semibold">{label}</div>
        <div className="text-gray-900">
          {money(min)}{" "}
          <span className="text-gray-400">-</span>{" "}
          {money(max)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* CONTACT INFORMATION */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold mb-3 text-gray-900">
          Contact Information
        </h3>

        <div className="space-y-1 text-sm">
          {form.name ? (
            <p className="text-gray-900 font-medium">{form.name}</p>
          ) : (
            <p className="text-gray-400 italic">No name entered</p>
          )}

          {form.phone ? (
            <p className="text-gray-700">{form.phone}</p>
          ) : (
            <p className="text-gray-400 italic">No phone entered</p>
          )}

          {form.email && <p className="text-gray-600">{form.email}</p>}
        </div>

        {form.address && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              `${form.address}, ${form.city}, ${form.state} ${form.zip}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-4 bg-gray-50 border rounded-lg p-3 hover:border-blue-400 transition shadow-sm"
          >
            <div className="text-xs text-gray-500 mb-1">Tap to open in Maps</div>
            <p className="text-gray-900 font-medium">{form.address}</p>
            <p className="text-gray-700 text-sm">
              {form.city}, {form.state} {form.zip}
            </p>
          </a>
        )}
      </div>

      {/* LEAD DETAILS */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold mb-3 text-gray-900">
          Lead Details
        </h3>

        <div className="space-y-2 text-sm text-gray-700">
          {form.buyerType && (
            <p>
              <span className="font-semibold">Buyer Type:</span>{" "}
              {form.buyerType}
            </p>
          )}

          {form.companyName && (
            <p>
              <span className="font-semibold">Company Name:</span>{" "}
              {form.companyName}
            </p>
          )}

          {form.projectType && (
            <p>
              <span className="font-semibold">Project Type:</span>{" "}
              {form.projectType}
            </p>
          )}

          {form.leadSource && (
            <p>
              <span className="font-semibold">Lead Source:</span>{" "}
              {form.leadSource}
            </p>
          )}

          {form.referralSource && (
            <p>
              <span className="font-semibold">Referral Source:</span>{" "}
              {form.referralSource}
            </p>
          )}

          {form.preferredContact && (
            <p>
              <span className="font-semibold">Preferred Contact:</span>{" "}
              {form.preferredContact}
            </p>
          )}

          {form.contractPrice && (
            <p>
              <span className="font-semibold">Contract Price:</span> $
              {form.contractPrice}
            </p>
          )}

          {form.notSoldReason && (
            <p className="text-red-700 font-semibold">
              Not Sold Reason: {form.notSoldReason}
            </p>
          )}
        </div>
      </div>

      {/* ESTIMATE BUTTON (VIEW ONLY, ONLY IF HAS ESTIMATE) */}
      {!isEditing && hasEstimate && (
        <button
          type="button"
          onClick={openEstimate}
          className="w-full bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:border-blue-400 transition text-left"
        >
          <div className="text-xs text-gray-500 mb-1">Estimate</div>
          <div className="flex items-center justify-between">
            <div className="text-gray-900 font-semibold">View Estimate</div>
            <div className="text-blue-600 font-bold">Open</div>
          </div>
        </button>
      )}

      {/* APPOINTMENT & INSTALL */}
      <div className="grid grid-cols-2 gap-4">
        {/* Appointment */}
        <div
          onClick={() => setShowApptModal(true)}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:border-blue-400 cursor-pointer transition"
        >
          <div className="text-xs text-gray-500 mb-1">Appointment</div>

          <div className="text-gray-900 font-semibold">
            {form.apptDate ? formatDate(form.apptDate) : "Not Set"}
          </div>

          <div className="text-gray-600 text-sm">
            {form.apptTime ? formatTime(form.apptTime) : "Not Set"}
          </div>
        </div>

        {/* Install Date */}
        <div
          onClick={() => setShowDateModal("installDate")}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:border-blue-400 cursor-pointer transition"
        >
          <div className="text-xs text-gray-500 mb-1">Install Date</div>

          <div className="text-gray-900 font-semibold">
            {form.installDate ? formatDate(form.installDate) : "Not Set"}
          </div>

          {form.installTentative && (
            <p className="text-xs text-gray-500 mt-1">Week of</p>
          )}
        </div>
      </div>

      {/* NOTES */}
      {form.notes ? (
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-2 text-gray-900">Notes</h3>
          <p className="text-gray-700 text-sm whitespace-pre-line">
            {form.notes}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-2 text-gray-900">Notes</h3>
          <p className="text-gray-400 text-sm italic">No notes added</p>
        </div>
      )}

      {/* ESTIMATE MODAL */}
      {showEstimateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeEstimate}
          />

          {/* Modal */}
          <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6">
            <div className="text-lg font-bold text-gray-900 mb-4">
              Estimate Details
            </div>

            {estimateLoading && (
              <div className="text-gray-600 text-sm">Loading estimate...</div>
            )}

            {!estimateLoading && estimateError && (
              <div className="text-sm text-red-600">{estimateError}</div>
            )}

            {!estimateLoading && !estimateError && estimate && (
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-gray-800 font-semibold">
                    {projectTypeLabel(computed.projectType)}
                  </p>

                  {renderSizeLine()}

                  {computed.condition && (
                    <p className="text-gray-700 text-sm mt-1">
                      <span className="font-semibold">Concrete Condition:</span>{" "}
                      {computed.condition}
                    </p>
                  )}

                  {computed.existingCoating !== null && (
                    <p className="text-gray-700 text-sm mt-1">
                      <span className="font-semibold">Existing Coating:</span>{" "}
                      {computed.existingCoating ? "Yes" : "No"}
                    </p>
                  )}

                  {computed.minimumJobApplied !== null && (
                    <p className="text-gray-700 text-sm mt-1">
                      <span className="font-semibold">Minimum Job Applied:</span>{" "}
                      {computed.minimumJobApplied ? "Yes" : "No"}
                    </p>
                  )}
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-sm font-bold text-gray-900 mb-2">
                    Pricing Range Shown
                  </div>

                  {renderRangeRow("Flake", computed.ranges.flake)}
                  {renderRangeRow("Solid", computed.ranges.solid)}
                  <div className="flex items-center justify-between py-2">
                    <div className="text-gray-800 font-semibold">Metallic</div>
                    <div className="text-gray-900">
                      {money(computed.ranges.metallic?.min)}{" "}
                      <span className="text-gray-400">-</span>{" "}
                      {money(computed.ranges.metallic?.max)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Back button */}
            <button
              type="button"
              onClick={closeEstimate}
              className="mt-5 w-full py-3 rounded-xl bg-blue-600 text-white font-bold"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
