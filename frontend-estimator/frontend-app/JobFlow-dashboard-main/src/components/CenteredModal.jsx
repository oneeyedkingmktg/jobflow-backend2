// File: src/CenteredModalWrapper.jsx
import React from "react";

export default function CenteredModalWrapper({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4 overflow-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-auto relative">
        {children}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="hidden"
            aria-hidden="true"
          >
            {/* optional escape hook */}
          </button>
        )}
      </div>
    </div>
  );
}
