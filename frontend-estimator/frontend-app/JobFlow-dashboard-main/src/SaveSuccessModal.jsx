// SaveSuccessModal.jsx
import React, { useEffect } from "react";

export default function SaveSuccessModal({ message = "Settings saved successfully!", onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 2000); // Auto close after 2 seconds
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white border border-green-300 rounded-lg shadow-lg p-6 w-80 text-center animate-fade-in">
        <p className="text-green-700 font-semibold text-lg">{message}</p>
      </div>
    </div>
  );
}
