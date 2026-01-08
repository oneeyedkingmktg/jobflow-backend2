// src/utils/formatting.js

export function formatDate(value) {
  if (!value) return "";

  const raw = String(value).trim();

  // Strip time / timezone safely
  const base = raw.split("T")[0].split(" ")[0];

  const parts = base.split("-");
  if (parts.length === 3) {
    const [a, b, c] = parts;

    // YYYY-MM-DD
    if (a.length === 4) {
      return `${b}-${c}-${a}`;
    }

    // MM-DD-YYYY (already formatted)
    if (c.length === 4) {
      return base;
    }
  }

  return base;
}


export function formatTime(value) {
  if (!value) return "";
  const [hourStr, minute] = value.split(":");
  let hour = parseInt(hourStr, 10);
  if (isNaN(hour)) return value;
  const ampm = hour >= 12 ? "PM" : "AM";
  if (hour > 12) hour -= 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${ampm}`;
}

export function formatPhoneNumber(value) {
  if (!value) return "";
  const phone = value.replace(/[^\d]/g, "");
  const len = phone.length;

  if (len < 4) return phone;
  if (len < 7) return `(${phone.slice(0, 3)}) ${phone.slice(3)}`;

  return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6, 10)}`;
}
