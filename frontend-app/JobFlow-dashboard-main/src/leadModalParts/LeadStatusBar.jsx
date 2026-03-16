// LeadStatusBar.jsx (Updated — Completed Modal + proceedWithAutomation control)
import React from "react";
import { STATUS_LABELS, STATUS_COLORS } from "./statusConfig.js";
import { useAuth } from "../AuthContext";

export default function LeadStatusBar({
  form,
  setForm,
  onOpenNotSold,
  onOpenApptModal,
  onOpenInstallModal,
}) {

  const { user } = useAuth();
  const isEstimatorOnly = user?.planType === 'estimator_only';

  const [pauseBlockAction, setPauseBlockAction] = React.useState(null);
  const [showCompleteModal, setShowCompleteModal] = React.useState(false);

  const currentStatus = form.status || "lead";

  const setStatus = (status) => {
    setForm((prev) => ({ ...prev, status }));
  };

  const guardedSetStatus = (status) => {
    if (form.pauseStatus === "Paused") {
      setPauseBlockAction(() => () => setStatus(status));
      return;
    }

    // 🔒 Intercept move to Complete
    if (status === "complete") {
      setShowCompleteModal(true);
      return;
    }

    setStatus(status);
  };

  const handleUnpauseAndAdvance = () => {
    setForm((prev) => ({ ...prev, pauseStatus: "Unpaused", pauseUntil: null }));
    if (pauseBlockAction) pauseBlockAction();
    setPauseBlockAction(null);
  };

  const handleKeepPaused = () => {
    setPauseBlockAction(null);
  };

  const handleCompleteDecision = (proceed) => {
    setForm((prev) => ({
      ...prev,
      status: "complete",
      proceedWithAutomation: proceed
    }));
    setShowCompleteModal(false);
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

    if (form.pauseStatus === "Paused") {
      setPauseBlockAction(() => () => {
        if (currentStatus === "appointment_set" && next === "sold") {
          setForm((prev) => ({ ...prev, status: "sold", notSoldReason: "" }));
          if (onOpenInstallModal) onOpenInstallModal();
          return;
        }
        guardedSetStatus(next);
      });
      return;
    }

    if (currentStatus === "appointment_set" && next === "sold") {
      setForm((prev) => ({ ...prev, status: "sold", notSoldReason: "" }));
      if (onOpenInstallModal) onOpenInstallModal();
      return;
    }

    guardedSetStatus(next);
  };

  const renderProgressButton = () => {
    if (
      currentStatus === "archived" ||
      currentStatus === "status_junk" ||
      currentStatus === "complete"
    )
      return null;

    if (currentStatus === "status_pre_lead") {
      return (
        <div className="flex gap-3 flex-1">
          <button
            onClick={() => guardedSetStatus("lead")}
            className="flex-1 py-3 rounded-lg text-white shadow flex flex-col items-center"
            style={{ backgroundColor: STATUS_COLORS["lead"] }}
          >
            <span className="text-[10px] uppercase opacity-80">move to</span>
            <span className="text-sm font-semibold">{">> Lead"}</span>
          </button>

          <button
            onClick={() => guardedSetStatus("status_junk")}
            className="flex-1 py-3 rounded-lg text-white shadow flex flex-col items-center"
            style={{ backgroundColor: STATUS_COLORS["status_junk"] }}
          >
            <span className="text-sm font-semibold">Mark as Junk</span>
          </button>
        </div>
      );
    }

    if (currentStatus === "not_sold") {
      return (
        <button
          onClick={() => guardedSetStatus("sold")}
          className="flex-1 py-3 rounded-lg text-white shadow flex flex-col items-center"
          style={{ backgroundColor: STATUS_COLORS["sold"] }}
        >
          <span className="text-[10px] uppercase opacity-80">move to</span>
          <span className="text-sm font-semibold">{"»» Sold"}</span>
        </button>
      );
    }

    if (currentStatus === "appointment_set") {
      return (
        <div className="flex gap-3 flex-1">
          <button
            onClick={handleProgression}
            className="flex-1 py-3 rounded-lg text-white shadow flex flex-col items-center"
            style={{ backgroundColor: STATUS_COLORS["sold"] }}
          >
            <span className="text-[10px] uppercase opacity-80">move to</span>
            <span className="text-sm font-semibold">{"»» Sold"}</span>
          </button>
          <button
            onClick={() => guardedSetStatus("not_sold")}
            className="flex-1 py-3 rounded-lg text-white shadow flex flex-col items-center"
            style={{ backgroundColor: STATUS_COLORS["not_sold"] }}
          >
            <span className="text-[10px] uppercase opacity-80">move to</span>
            <span className="text-sm font-semibold">{"»» Not Sold"}</span>
          </button>
        </div>
      );
    }

    const next = NEXT_STATUS[currentStatus];
    const label = NEXT_LABEL[currentStatus];

    return (
      <button
        onClick={handleProgression}
        className="flex-1 py-3 rounded-lg text-white shadow flex flex-col items-center"
        style={{ backgroundColor: STATUS_COLORS[next] }}
      >
        <span className="text-[10px] uppercase opacity-80">move to</span>
        <span className="text-sm font-semibold">{"»» " + label}</span>
      </button>
    );
  };

  return (
    <>
      {showCompleteModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Send Follow-Up?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Do you want to send review and follow-up messages?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleCompleteDecision(true)}
                className="flex-1 py-2 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700"
              >
                Yes
              </button>
              <button
                onClick={() => handleCompleteDecision(false)}
                className="flex-1 py-2 rounded-xl bg-gray-200 text-gray-800 font-semibold text-sm hover:bg-gray-300"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {pauseBlockAction && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Lead is paused.</h3>
            <p className="text-sm text-gray-600 mb-6">Do you want to unpause them?</p>
            <div className="flex gap-3">
              <button
                onClick={handleUnpauseAndAdvance}
                className="flex-1 py-2 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700"
              >
                Unpause & Advance
              </button>
              <button
                onClick={handleKeepPaused}
                className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-800 font-semibold text-sm hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isEstimatorOnly ? (
        <div className="relative w-full">
          <div className="opacity-30 pointer-events-none select-none flex items-center justify-between gap-3 w-full">
            <div className="flex flex-col">
              <div className="text-black text-[10px] uppercase font-semibold mb-1" style={{ paddingLeft: "25px" }}>CURRENT STATUS</div>
              <div className="bg-gray-400 rounded-2xl px-6 py-3 text-white font-semibold">Status</div>
            </div>
            <div className="bg-gray-200 rounded-xl px-4 py-2 text-gray-400 font-semibold">Move To</div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-semibold text-gray-500 bg-white/80 px-3 py-1 rounded-full border border-gray-200">🔒 Upgrade to Pro</span>
          </div>
        </div>
      ) : (
      <div className="flex items-center justify-between gap-3 w-full">
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
              onChange={(e) => guardedSetStatus(e.target.value)}
              className="appearance-none font-semibold rounded-2xl w-full px-4 pr-10 shadow cursor-pointer"
              style={{
                backgroundColor: STATUS_COLORS[form.status],
                color: "#FFFFFF",
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
      )}
    </>
  );
}