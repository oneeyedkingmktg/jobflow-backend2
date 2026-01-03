// ============================================================================
// Estimator Validation Utilities
// File: estimator/utils/validators.js
// Version: v2.0.0
// ============================================================================

export function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function validPhone(v) {
  return /^\D*(\d\D*){10,}$/.test(v);
}

export function formatPhoneNumber(value) {
  const cleaned = value.replace(/\D/g, "");
  const limited = cleaned.substring(0, 10);

  if (limited.length <= 3) {
    return limited;
  } else if (limited.length <= 6) {
    return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  } else {
    return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
  }
}

export function formatPhoneDisplay(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}