// File: src/leadModalParts/LeadStatusBar.jsx
// Version: v1.1 – Auto-open appointment modal on status change

import React from "react";
import { STATUS_LABELS, STATUS_COLORS } from "./statusConfig.js";

export default function LeadStatusBar({
  form,
  setForm,
  onOpenNotSold,
  onOpenApptModal,
  onOpenInstallModal,
}) {

  const currentStatus = form.status || "lead";

  const setStatus = (status) => {
    setForm((prev) => ({ ...prev, status }));
    
    // Auto-open appointment modal when status becomes appointment_set
    if (status === "appointment_set" && onOpenApptModal) {
      setTimeout(() => onOpenApptModal(), 100);
    }
  };

  const NEXT_STATUS = {
    lead: "appointment_set",
    appointment_set: "sold",
    sold: "complete",
    complete: "archived",
  };

  const NEXT_LABEL = {
    lead: "Appointment Set",
    appointment_set: "Sold",
    sold: "Complete",
    complete: "Archive",
  };

  const handleProgression = () => {
    const next = NEXT_STATUS[currentStatus];
    if (!next) return;

    if (currentStatus === "appointment_set" && next === "sold") {
      setForm((prev) => ({ ...prev, status: "sold", notSoldReason: "" }));
      if (onOpenInstallModal) onOpenInstallModal();
      return;
    }

    setStatus(next);
  };

  const renderProgressButton = () => {
    if (currentStatus === "archived") return null;

    if (currentStatus === "not_sold") {
      return (
        <button
          onClick={() => setStatus("sold")}
          className="px-5 py-3 rounded-lg text-white shadow flex flex-col"
          style={{ backgroundColor: STATUS_COLORS["sold"] }}
        >
          <span className="text-[10px] uppercase opacity-80">move to</span>
          <span className="text-sm font-semibold">
            {"»» Sold"}
          </span>
        </button>
      );
    }

    if (currentStatus === "appointment_set") {
      return (
        <div className="flex gap-3">
          <button
            onClick={handleProgression}
            className="px-5 py-3 rounded-lg text-white shadow flex flex-col"
            style={{ backgroundColor: STATUS_COLORS["sold"] }}
          >
            <span className="text-[10px] uppercase opacity-80">move to</span>
            <span className="text-sm font-semibold">
              {"»» Sold"}
            </span>
          </button>

          <button
            onClick={onOpenNotSold}
            className="px-5 py-3 rounded-lg text-white shadow flex flex-col"
            style={{ backgroundColor: STATUS_COLORS["not_sold"] }}
          >
            <span className="text-[10px] uppercase opacity-80">move to</span>
            <span className="text-sm font-semibold">
              {"»» Not Sold"}
            </span>
          </button>
        </div>
      );
    }

    const next = NEXT_STATUS[currentStatus];
    const label = NEXT_LABEL[currentStatus];

    return (
      <button
        onClick={handleProgression}
        className="px-5 py-3 rounded-lg text-white shadow flex flex-col"
        style={{ backgroundColor: STATUS_COLORS[next] }}
      >
        <span className="text-[10px] uppercase opacity-80">move to</span>
        <span className="text-sm font-semibold">
          {"»» " + label}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      <div className="flex flex-col">
        <div
          className="text-black text-[10px] uppercase font-semibold mb-1"
          style={{ paddingLeft: "25px" }}
        >
          CURRENT STATUS
        </div>

        <div className="relative w-full sm:w-auto">
          <select
            value={form.status}
            onChange={(e) => setStatus(e.target.value)}
            className="appearance-none text-white font-semibold rounded-2xl w-full px-4 pr-10 shadow cursor-pointer"
            style={{
              backgroundColor: STATUS_COLORS[form.status],
              height: "48px",
              fontSize: "1.05rem",
            }}
          >
            {Object.keys(STATUS_LABELS).map((s) => (
              <option
                key={s}
                value={s}
                style={{
                  padding: "14px 0",
                  fontSize: "1.1rem",
                  background: "white",
                  color: "black",
                }}
              >
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>

          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white"
            style={{ fontSize: "18px" }}
          >
            ▼
          </div>
        </div>
      </div>

      {renderProgressButton()}
    </div>
  );
}