// ============================================================================
// Estimator Config Hook
// File: estimator/hooks/useEstimatorConfig.js
// Version: v2.0.2 - Fixed company parameter
// ============================================================================

import { useEffect, useState } from "react";

function generateCustomStyles(cfg) {
  const fontFamily = cfg.font_family || 'system-ui, -apple-system, sans-serif';
  const baseFontSize = cfg.base_font_size || 16;
  const textColor = cfg.text_color || '#000000';
  const primaryBtnColor = cfg.primary_button_color || '#f97316';
  const primaryBtnTextColor = cfg.primary_button_text_color || '#ffffff';
  const primaryBtnRadius = cfg.primary_button_radius || 8;
  const primaryBtnHoverColor = cfg.primary_button_hover_color || '#ea580c';
  const accentColor = cfg.accent_color || '#f97316';
  const boxedTextColor = cfg.boxed_text_color || '#92400e';
  const cardBgColor = cfg.card_background_color || '#ffffff';
  const cardBorderRadius = cfg.card_border_radius || 12;
  const cardShadowStrength = cfg.card_shadow_strength || 'medium';
  const maxWidth = cfg.max_width || 768;

  console.log("Generating styles with:", {
    primaryBtnColor,
    primaryBtnTextColor,
    primaryBtnRadius,
    primaryBtnHoverColor
  });

  const shadowMap = {
    'none': '0 0 0 rgba(0,0,0,0)',
    'light': '0 1px 3px rgba(0,0,0,0.1)',
    'medium': '0 4px 6px rgba(0,0,0,0.1)',
    'heavy': '0 10px 15px rgba(0,0,0,0.15)'
  };
  const shadow = shadowMap[cardShadowStrength] || shadowMap['medium'];

  return `
    .estimator-container {
      font-family: ${fontFamily};
      font-size: ${baseFontSize}px;
      color: ${textColor};
      max-width: ${maxWidth}px;
    }
    .estimator-card {
      background-color: ${cardBgColor};
      border-radius: ${cardBorderRadius}px;
      box-shadow: ${shadow};
    }
    .estimator-primary-btn {
      background-color: ${primaryBtnColor} !important;
      color: ${primaryBtnTextColor} !important;
      border-radius: ${primaryBtnRadius}px;
    }
    .estimator-primary-btn:hover:not(:disabled) {
      background-color: ${primaryBtnHoverColor} !important;
    }
    .estimator-accent {
      color: ${accentColor};
      border-color: ${accentColor};
    }
    .estimator-boxed-text {
      color: ${boxedTextColor};
    }
    .estimator-selected-btn {
      background-color: ${primaryBtnColor} !important;
      color: ${primaryBtnTextColor} !important;
      border-color: ${primaryBtnColor};
    }
  `;
}

function injectTrackingTag(html) {
  if (!html || !html.trim()) return;
  const container = document.createElement('div');
  container.innerHTML = html;
  container.querySelectorAll('script').forEach(oldScript => {
    const newScript = document.createElement('script');
    Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
    newScript.textContent = oldScript.textContent;
    document.head.appendChild(newScript);
  });
}

const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

function applyConfig(data, setConfig, setCustomStyles) {
  setConfig(data);
  injectTrackingTag(data.google_base_tag);
  injectTrackingTag(data.meta_base_tag);
  // Microsoft UET must NOT be injected into the iframe — it lives on the parent page only.
  // Injecting it here causes UET to auto-track the form submission from inside the iframe,
  // doubling the conversion when the postMessage also fires it on the parent page.
  setCustomStyles(generateCustomStyles(data));
}

export default function useEstimatorConfig() {
  const [config, setConfig] = useState(null);
  const [customStyles, setCustomStyles] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const companyId = params.get("company") || "1";
    const cacheKey = `estimator-config-${companyId}`;

    // Try cache first
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL_MS) {
          applyConfig(data, setConfig, setCustomStyles);
          return; // skip fetch
        }
      }
    } catch (e) {
      // ignore corrupt cache
    }

    fetch(`${import.meta.env.VITE_API_URL || "https://api.coatingpro360.com"}/estimator/config?company=${companyId}`)
      .then(res => res.json())
      .then(data => {
        applyConfig(data, setConfig, setCustomStyles);
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
        } catch (e) {
          // ignore storage errors (private browsing, quota)
        }
      })
      .catch(err => {
        console.error("❌ estimator config error", err);
      });
  }, []);


  const useCustomStyles = config?.use_embedded_styles === true;

  return { config, customStyles, useCustomStyles };
}