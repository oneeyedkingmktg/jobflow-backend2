import React from "react";

export default function SuspendedScreen({ supportPhone, supportEmail }) {
  return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 text-center space-y-4">
        <h1 className="text-2xl font-extrabold text-red-700">
          Account Suspended
        </h1>
        <p className="text-gray-700">
          This company&apos;s JobFlow account is currently suspended.
        </p>
        <p className="text-gray-600 text-sm">
          Please contact support to resolve this issue:
        </p>
        <div className="space-y-1">
          {supportPhone && (
            <p className="font-semibold text-gray-900">
              Phone: <span className="text-blue-700">{supportPhone}</span>
            </p>
          )}
          {supportEmail && (
            <p className="font-semibold text-gray-900">
              Email: <span className="text-blue-700">{supportEmail}</span>
            </p>
          )}
        </div>
        <p className="text-xs text-gray-500 pt-2">
          If you believe this is an error, please reach out to the system
          administrator.
        </p>
      </div>
    </div>
  );
}
