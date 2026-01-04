// src/utils/formatting.js

export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date)) return "";
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
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
