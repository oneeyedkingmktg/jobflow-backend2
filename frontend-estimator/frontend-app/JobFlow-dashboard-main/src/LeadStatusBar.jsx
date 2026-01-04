import React from "react";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_PROGRESS,
} from "./statusConfig.js";

export default function LeadStatusBar({ form, setForm, onOpenNotSold }) {
  const currentStatus = form.status;
  const nextStatus = STATUS_PROGRESS[currentStatus] || null;

  const handleProgress = () => {
    if (!nextStatus) return;

    // Appointment Set → Sold
    if (currentStatus === "appointment_set" && nextStatus === "sold") {
      setForm((p) => ({ ...p, status: "sold", notSoldReason: "" }));
      return;
    }

    // Appointment Set → Not Sold → open modal
    if (currentStatus === "appointment_set" && nextStatus === "not_sold") {
      onOpenNotSold();
      return;
    }

    // Normal progression
    setForm((p) => ({ ...p, status: nextStatus }));
  };

  return (
    <div className="flex items-center justify-between gap-4">
      {/* STATUS SELECTOR */}
      <div className="relative">
        <select
          value={form.status}
          onChange={(e) =>
            setForm((p) => ({ ...p, status: e.target.value }))
          }
          className="appearance-none bg-[#59687d] text-white text-sm font-semibold px-4 py-2 rounded-full pr-8 shadow cursor-pointer"
        >
          {Object.keys(STATUS_LABELS).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white text-sm pointer-events-none">
          ▼
        </span>
      </div>

      {/* PROGRESSION BUTTON */}
      {nextStatus ? (
        <button
          onClick={handleProgress}
          className="px-6 py-2 rounded-full text-sm font-bold shadow text-white flex items-center"
          style={{ backgroundColor: STATUS_COLORS[nextStatus] }}
        >
          <span className="mr-1">»»</span>
          {STATUS_LABELS[nextStatus].toUpperCase()}
        </button>
      ) : (
        <button
          disabled
          className="px-6 py-2 rounded-full text-sm font-bold shadow text-gray-600 bg-gray-300"
        >
          NO NEXT STEP
        </button>
      )}
    </div>
  );
}
