import React from "react";

export default function InputRow({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  required = false,
  options = [],
  multiline = false,
  prefix = null,
  suffix = null
}) {
  return (
    <div className="space-y-1 w-full">
      {/* LABEL */}
      {label && (
        <label className="block text-sm font-semibold text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* SELECT FIELD */}
      {type === "select" ? (
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 
            focus:border-blue-500 focus:ring-4 focus:ring-blue-100 
            transition-all duration-200 shadow-sm bg-white"
        >
          <option value="">Select…</option>

          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : multiline ? (
        /* TEXTAREA FIELD */
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 
            focus:border-blue-500 focus:ring-4 focus:ring-blue-100 
            transition-all duration-200 shadow-sm resize-none"
        />
      ) : (
        /* STANDARD INPUT WITH OPTIONAL PREFIX/SUFFIX */
        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
              {prefix}
            </span>
          )}

          <input
            type={type}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full px-4 py-3 rounded-xl border-2 border-gray-200 
              focus:border-blue-500 focus:ring-4 focus:ring-blue-100 
              transition-all duration-200 shadow-sm
              ${prefix ? "pl-8" : ""}
              ${suffix ? "pr-8" : ""}
            `}
          />

          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
              {suffix}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
