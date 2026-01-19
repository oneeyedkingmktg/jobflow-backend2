// ============================================================================
// File: src/utils/timezone.js
// Purpose: Convert UTC date/time to company-local display time
// ============================================================================

export function formatInCompanyTimezone({
  utcDate,        // e.g. "2026-01-08"
  utcTime,        // e.g. "05:00"
  timezone,       // e.g. "America/Chicago"
  format = "datetime", // "datetime" | "time" | "date"
}) {
  // ✅ Catch null, undefined, AND empty strings
  if (!utcDate || utcDate === "") return "—";

  const timePart = utcTime || "00:00";
  const isoString = `${utcDate}T${timePart}:00Z`; // force UTC

  const date = new Date(isoString);
  
  // ✅ Catch invalid dates
  if (isNaN(date.getTime())) return "—";

  const options =
    format === "time"
      ? { timeZone: timezone, hour: "numeric", minute: "2-digit" }
      : format === "date"
      ? { timeZone: timezone, year: "numeric", month: "short", day: "numeric" }
      : {
          timeZone: timezone,
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        };

  return new Intl.DateTimeFormat("en-US", options).format(date);
}
