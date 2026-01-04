// File: src/leadComponents/leadHelpers.js

// Normalize phone → digits only
export const normalizePhone = (phone) => {
  return phone ? phone.replace(/\D/g, "") : "";
};

// Normalize DB date → YYYY-MM-DD
export const normalizeDate = (d) => {
  if (!d) return "";
  const [datePart] = String(d).split(" ");

  // already correct
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;

  // YY-MM-DD → assume 20YY-MM-DD
  if (/^\d{2}-\d{2}-\d{2}$/.test(datePart)) {
    const [yy, mm, dd] = datePart.split("-");
    return `20${yy}-${mm}-${dd}`;
  }

  return datePart;
};

// Convert YYYY-MM-DD → MM/DD/YYYY
export const formatDisplayDate = (d) => {
  if (!d) return "";
  const iso = normalizeDate(d);
  const [y, m, day] = iso.split("-");
  return `${m}/${day}/${y}`;
};

// Convert "HH:mm" → h:mm AM/PM
export const formatDisplayTime = (t) => {
  if (!t) return "";
  let [h, m] = t.split(":");
  h = parseInt(h, 10);
  return `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;
};

// Top bar text on each card
export const getStatusBarText = (lead) => {
  switch (lead.status) {
    case "appointment_set":
      const d = formatDisplayDate(lead.apptDate);
      const t = formatDisplayTime(lead.apptTime);
      return d || t ? `Appointment: ${d} ${t}` : "Appointment Set";

    case "sold":
      if (lead.installDate) {
        const ds = formatDisplayDate(lead.installDate);
        return lead.installTentative
          ? `Install ${ds} (Tentative)`
          : `Install ${ds}`;
      }
      return "Sold";

    case "not_sold":
      return "Not Sold";

    case "complete":
      return "Completed";

    default:
      return "Lead";
  }
};

// REQUIRED EXPORT — Fixes Vercel build error
export const STATUS_COLORS = {
  lead: "#59687d",
  appointment_set: "#225ce5",
  sold: "#048c63",
  not_sold: "#c72020",
  complete: "#ea8e09",
};
