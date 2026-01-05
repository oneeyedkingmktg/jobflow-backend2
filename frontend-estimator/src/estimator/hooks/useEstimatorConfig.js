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

export default function useEstimatorConfig() {
  const [config, setConfig] = useState(null);
  const [customStyles, setCustomStyles] = useState("");

useEffect(() => {
  console.log("🔥 estimator config useEffect fired");

  fetch(`${import.meta.env.VITE_API_URL}/estimator/config?company=1`)
    .then(res => res.json())
    .then(data => {
      console.log("✅ estimator config response", data);
      setConfig(data);
    })
    .catch(err => {
      console.error("❌ estimator config error", err);
    });
}, []);


  const useCustomStyles = config?.use_embedded_styles === true;

  return { config, customStyles, useCustomStyles };
}