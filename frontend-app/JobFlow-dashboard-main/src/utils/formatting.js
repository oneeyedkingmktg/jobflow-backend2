// ============================================================================
// File: src/utils/formatting.js
// Purpose: Formatting utilities for dates, times, and phone numbers
// ============================================================================

export function formatDate(value, timezone = null) {
  if (!value) return "Not Set";

  try {
    const raw = String(value).trim();
    
    // If timezone provided, use it for display
    if (timezone) {
      // Handle both ISO strings and simple dates
      let dateObj;
      if (raw.includes('T')) {
        dateObj = new Date(raw);
      } else {
        // Treat as YYYY-MM-DD in UTC
        dateObj = new Date(raw + 'T00:00:00Z');
      }
      
      return new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(dateObj);
    }

    // Fallback: simple date formatting without timezone
    const base = raw.split("T")[0].split(" ")[0];
    const parts = base.split("-");
    
    if (parts.length === 3) {
      const [a, b, c] = parts;

      // YYYY-MM-DD -> MM-DD-YYYY
      if (a.length === 4) {
        return `${b}-${c}-${a}`;
      }

      // MM-DD-YYYY (already formatted)
      if (c.length === 4) {
        return base;
      }
    }

    return base;
  } catch (error) {
    console.error('Error formatting date:', error);
    return value;
  }
}

export function formatTime(value, timezone = null) {
  if (!value) return "Not Set";

  try {
    // If timezone provided and value looks like UTC time
    if (timezone && value.includes(':')) {
      const [hour, minute] = value.split(':');
      // Create a date object for today at this UTC time
      const utcDate = new Date();
      utcDate.setUTCHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
      
      return new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(utcDate);
    }

    // Fallback: simple time formatting
    const [hourStr, minute] = value.split(":");
    let hour = parseInt(hourStr, 10);
    if (isNaN(hour)) return value;
    
    const ampm = hour >= 12 ? "PM" : "AM";
    if (hour > 12) hour -= 12;
    if (hour === 0) hour = 12;
    
    return `${hour}:${minute} ${ampm}`;
  } catch (error) {
    console.error('Error formatting time:', error);
    return value;
  }
}

export function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatPhoneNumber(value) {
  if (!value) return "";
  let digits = value.replace(/[^\d]/g, "");

  // Strip US country code (1 + 10 digits = 11 digits starting with 1)
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }

  const len = digits.length;
  if (len < 4) return digits;
  if (len < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}