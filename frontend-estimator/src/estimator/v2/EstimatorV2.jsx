// ============================================================================
// Estimator V2 — Step-by-step flow
// File: estimator/v2/EstimatorV2.jsx
// Build: All 5 steps + results + second estimate flow + combined results
// ============================================================================

import { useState } from "react";
import useEstimatorConfig from "../hooks/useEstimatorConfig";
import { validEmail, validPhone, formatPhoneNumber } from "../utils/validators";

const API_BASE = import.meta.env.VITE_API_URL || "https://api.coatingpro360.com";
const _urlParams  = new URLSearchParams(window.location.search);
const _utmSource   = _urlParams.get("utm_source")   || null;
const _utmMedium   = _urlParams.get("utm_medium")   || null;
const _utmCampaign = _urlParams.get("utm_campaign") || null;

const TOTAL_STEPS = 5;

// ---- Inline link renderer ----
function renderTextWithInlineLinks(text) {
  if (!text || typeof text !== "string") return null;
  const parts = [];
  const re = /\((https?:\/\/[^,\s]+)\s*,\s*([^)]+)\)/g;
  let lastIndex = 0, match, i = 0;
  while ((match = re.exec(text)) !== null) {
    const [full, url, linkText] = match;
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(<a key={i++} href={url} target="_top" className="underline">{linkText}</a>);
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  if (parts.length === 0) return text;
  return parts.map((p, j) => typeof p === "string" ? <span key={j}>{p}</span> : p);
}

// ---- SVG Icons — paths from Test/icons/ SVG files ----

function IconGarage({ color }) {
  return (
    <svg viewBox="-2200 3700 7000 5500" width="68" height="68">
      <g fillRule="evenodd" clipRule="evenodd" fill={color}>
        <path d="M-462.04 6317.95c0,-36.54 27.6,-80 60,-80l3610 0c97.44,0 95.09,130 -10,130l-3580 0c-32.88,0 -80,-30.44 -80,-50zm50 -450l3640 0c56.09,0 82.48,120 -20,120l-3600 0c-89.07,0 -82.54,-120 -20,-120zm100 -370l3410 0c53.11,0 53.11,100 0,100l-3420 0c-53.83,0 -44.18,-100 10,-100zm-500 10l0 3180 310 0 0 -2110 448.47 6.29c50.96,0.94 -5.36,-6.29 41.53,-6.29 24.57,0 38.54,5.69 51.34,6l272.81 -1.3c93.67,-4.95 143.77,4.82 197.14,1.93l90.11 -0.3c49.37,0.69 -10.09,-6.34 38.6,-6.34l390 0c35.33,0 21.9,6.07 41.4,6.34 49.37,0.69 -10.09,-6.34 38.6,-6.34l132.09 6.67c55.18,1.01 4.38,-6.67 47.91,-6.67 34.19,0 22.03,5.66 41.16,6.16l71.7 -1.26c47.13,0.62 -4,-4.9 27.14,-4.9 45.04,0 28.93,7.98 68.35,6.46l251.65 -6.46c72.71,0 38.77,10.48 161.43,1.7l1120.36 0.12c20.22,-1.11 24.54,0.12 42.12,0.67l226.09 -2.48c23.04,0 30,6.96 30,30l0 2080 290 0 2.82 -311.9c-13.42,-119.99 -2.82,-2700.09 -2.82,-2888.1l-956.64 -533.36c-31.56,-16.01 -41.34,-23.74 -70.16,-39.84 -26.72,-14.93 -48.44,-23.14 -72.76,-37.24 -43.45,-25.2 -85.1,-51.5 -133.8,-76.2l-976.64 -533.36 -694.22 375.78c-243.68,145.44 -573.73,311.58 -836.22,463.78 -24.32,14.1 -46.04,22.31 -72.76,37.24l-488.73 271.27c-29.91,18.17 -128.07,55.59 -128.07,91.93z"/>
        <path d="M-1902.04 5187.95c0,125.83 98.61,460 260,460 71.66,0 673.14,-353.24 773.33,-406.67 66.06,-35.24 126.13,-67.61 187.13,-102.87l2089.55 -1150.45 1045.78 574.22c148.63,88.71 328.56,174.69 476.14,263.86 199.68,120.66 561.28,299.07 760.02,419.98l568 312c205.65,101.92 256.04,175.99 393.49,-96.66 31.74,-62.96 76.59,-185.64 76.59,-273.41 0,-95.14 -87.84,-135.09 -149.48,-170.52l-421.04 -238.96c-260.66,-150.29 -588.74,-322.86 -837.56,-472.44 -68.66,-41.27 -142.11,-81.94 -211.98,-118.02l-1570.44 -889.56c-139.63,-85.13 -187.97,-49.27 -345.25,43.76 -72.56,42.92 -136.64,78.65 -210.82,119.18 -73.36,40.07 -135.78,82.26 -210.07,119.93l-841.44 478.56c-71.35,42.9 -140.31,77.46 -211.47,118.53l-623.77 356.23c-235.33,125.14 -497.61,288.47 -733.25,416.75 -101.93,55.49 -263.43,128.97 -263.43,236.57z"/>
        <path d="M867.96 7917.95l1080 0c34.54,0 43.36,31.5 50,60l-8.82 11.17c-19.17,19.76 -27.25,28.83 -61.18,28.83 -174.69,0 -984.11,14.67 -1090,-10 -28.02,-58.4 -5.27,-90 30,-90zm-690 10c0,-47.35 -18.57,-190 60,-190 236.78,0 470.87,-11.28 410,250 -93.02,21.67 -294.1,10 -400,10 -46.68,0 -70,-23.32 -70,-70zm2470 -120c0,234.15 50.24,190 -440,190 -61.3,0 -49.59,-107.61 -33.24,-153.18 22.19,-61.82 59.95,-76.3 130.19,-89.87 23.11,-4.46 65.71,-5.82 103.06,-7.59 69.43,-3.3 239.99,-47.09 239.99,60.64zm-1790 -810l1090 0c339.07,0 303.12,204.48 395.67,377.01 12.08,22.53 6.33,12.65 14.28,22.99 -229.41,0 -1807.31,-20.06 -1889.95,9.95 93.68,-281.61 124.35,-409.95 390,-409.95zm-620 409.95c0,-73.72 -7.39,-65.81 -20,-119.95l-200.64 -0.64c-165.9,2.72 -141.5,217.73 -47.09,238.36 56.11,12.26 112.76,12.28 177.67,12.28l-52.82 37.75c-36.85,31.82 -97.13,100.54 -97.13,152.25l0 880c0,48.37 31.63,80 80,80l370 0c116.49,0 90,-148.41 90,-260l1740 0c0,308.92 -45.13,260 470,260 53.92,0 90,-49.46 90,-100l0 -760c0,-72.33 -9.85,-138.54 -39.51,-180.49 -18.26,-25.83 -76.57,-95.09 -110.49,-99.56 128.88,-49.78 240,46.13 240,-159.95 0,-129.24 -179.97,-100 -290,-100 -57.78,0 -50.03,93.2 -50.05,100 -29.97,-18.84 -12.21,11.52 -48.47,-81.52 -77.8,-199.59 -182.45,-468.48 -421.48,-468.48l-1410 0c-152.74,0 -236.97,94.67 -304.4,205.6 -31.35,51.58 -59.52,118.25 -82.76,177.24l-82.84 187.11z"/>
        <path d="M-1442.04 5767.95l0 2890c0,23.04 6.96,30 30,30l420 0 0 -3160c-56.48,1.26 -186.19,72.91 -242.89,97.11l-174.77 85.23c-23.65,15.49 -32.34,17.76 -32.34,57.66z"/>
        <path d="M3817.96 8687.95l410 0c23.41,0 40,-16.59 40,-40l0 -2900c0,-40.04 -59.28,-52.89 -92.88,-67.12 -72.08,-30.53 -298.7,-151.58 -357.12,-152.88l0 3160z"/>
      </g>
    </svg>
  );
}

function IconBasement({ color }) {
  return (
    <svg viewBox="7500 5200 2800 3500" width="68" height="68">
      <g fillRule="evenodd" clipRule="evenodd" fill={color}>
        <path d="M9444.91 7081.96l-467.63 6.85 0.31 389.02 -468.31 3.3c-18.28,46.51 -9.52,317.06 -7.69,395.51 -59.54,-1.31 -386.44,-5.15 -454.95,6.42 -31.07,87.44 -1.35,246.16 -10.4,349.78 -87.28,13.17 -358.6,-26.22 -409.38,19.26 -20.09,20.6 -14.36,24.08 -15.01,88.82 -1.52,152.05 -7.91,120.45 332.97,119.97 377.33,-0.54 253.95,45.37 522.43,-167 37.23,-29.45 62.94,-47.67 95.98,-74.1 45.93,-36.74 70.36,-50.19 90.03,-90.92l-393.66 -5.31 -1.44 -38.31 429.57 -2.98c18.5,-82.49 -16.15,-343.71 17.03,-388.68l474.7 -3.95c22.59,-100.6 -20.59,-312.15 11.46,-390.61l455.1 -3.44 2.15 -381.86 533.66 -1.87c1.25,-6.04 2.52,-13.52 2.91,-12.19 0.4,1.33 2.14,-6.57 2.63,-9.16l-0.59 -192.09c-59.74,-14.44 -666.4,-13.94 -735.42,-1.63 -16.44,87.15 -6.35,282.94 -6.47,385.15z"/>
        <path d="M7871 7236.74l-1.43 958.54 116.86 0.85 0.58 -1045.05 1045.1 -752.12c12.7,-8.75 19.69,-11.07 31.27,-18.98l359.15 -260.66c12.05,-8.63 19.02,-11.19 30.57,-19.35l86.77 -62.98c24.14,-18.7 39.19,-25.18 59.2,-40.97l304.5 -217.06c1.61,201.62 -5.41,674.79 5.13,867.72l110.03 0.7c8.96,-284.26 4.37,-629.67 2.39,-922.74l137.88 0.12c39.96,-8.28 63.06,-55.19 48.03,-102.53 -20.74,-65.33 -125.7,-46.24 -212.22,-46.31 -97.22,-0.09 -76,8.18 -196.17,88.6 -13.4,8.96 -29.04,21.64 -39.88,29.67 -22.21,16.44 -26.69,16.67 -42.87,27.7l-58.25 41.88c-18.94,12.63 -3.39,1.74 -22.62,16.94l-1025.43 734.27c-16.67,12.17 -22.13,19.52 -38.52,31.56l-529.27 380.46c-20.68,15.22 -26.76,17.17 -47.52,32.77 -27.22,20.45 -51.91,38.13 -81.73,58.31l-243.57 176.61c-124.04,82.08 -26.52,210.05 78.57,129.85l123.45 -87.82z"/>
        <path d="M9218.43 7673.18c66.77,-14.62 290.15,-223.28 362.5,-275.55 42.32,-30.57 35.56,-22.53 45.9,-56.28l-405.75 -0.1 -2.65 331.93z"/>
        <path d="M8734.82 8067.31c47.43,-19.31 164.56,-122.54 207.82,-157.72 42.7,-34.72 169.8,-116.46 197.26,-173.2l-404.44 -1.31 -0.64 332.23z"/>
        <path d="M9696.26 7288.78c25.94,-4.9 117.51,-82.07 148.12,-107.64l98.44 -81.59c28.42,-27.03 22.54,-19.76 49.75,-40.62 25.37,-19.44 75.48,-63.27 79.64,-94.89l-376.56 -2.38c-10.12,53.09 -10.77,275.67 0.6,327.12z"/>
      </g>
    </svg>
  );
}

function IconPatio({ color }) {
  return (
    <svg viewBox="7300 8800 3000 3500" width="68" height="68">
      <g fillRule="evenodd" clipRule="evenodd" fill={color}>
        <path d="M8890.08 9007.1l478.31 591.03 -968.43 -1.71 490.12 -589.32zm-154.97 58.89c-19.78,2.78 -57.86,75.55 -93.91,112.07l-356.4 420.91 -546.51 -10.97 996.82 -522.01zm1019.71 530.32c-52.64,1.33 -106.94,0.12 -160.02,0.87 -97.45,1.38 -101.37,10.67 -132.26,-23.46l-73.02 -86.64c-10.04,-12.46 -8.65,-12.73 -16.94,-23.39l-306.66 -374.46c-13.04,-18.65 -0.12,-7.55 -15.43,-23.23 -17.11,-17.53 -1.87,-10.65 -15.73,-5.81 47.94,7.9 952.9,514.87 1012.23,529.3l-292.18 6.82zm-2173.41 114.77c39.21,41.98 140.15,33.53 195.76,35.56 92.33,3.36 267.94,71.11 418.06,50.63 108.57,-14.81 92.47,-55.29 139.6,-102.35 48.06,33.89 14.39,108.02 229.97,107.87 201.63,-0.15 202.19,-38.32 282.13,-56.03 -0.76,73.43 -18.52,592.51 10.5,650.51l68.2 1.59 11.35 -651.79c105.82,39.3 303.14,84.55 416.14,34.95 69.23,-30.38 40.8,-38.02 81.71,-88.44 84.23,57.85 -25.72,135.19 347.13,87.31 76.33,-9.81 110.87,-28.3 192.44,-30.08 70.92,-1.55 164.07,-7.91 224.62,-26.07 67.98,-169.26 -26.31,-165.22 -232.07,-277.06l-1063.52 -558.47c-42.81,-5.79 -605.28,303.02 -716.33,362.57 -117.47,62.98 -233.77,126.19 -353.42,187.18 -55.61,28.35 -115.26,59.07 -177.92,91.94 -29.97,15.72 -67.6,29.39 -80.03,53.26 -17.71,34.01 -13.26,99.86 5.68,126.92z"/>
        <path d="M9860.18 10803.1c-102.41,0.43 -412.67,-14.6 -493.91,18.03 -18.2,82.85 -8.21,118.48 85.04,115.37 -23.23,98.73 -107.15,391.17 -94.46,464.04 16.64,5.62 40.76,15.99 67.24,10.89 36.41,-7.02 27.42,-15.54 37.76,-56.79l101.59 -419.49 271.37 1.27 161.44 470.84 63.46 4.91c60.98,-60.73 16.46,-83.18 -33.78,-241.82 -114.35,-361.13 -82.36,-174.67 -45.58,-317.34l114.44 -465.72c20.7,-79.12 43.26,-126.17 19.97,-196.02 -128.27,-24.33 -98.75,11.26 -163.9,265.64 -16.69,65.18 -68.46,302.98 -90.69,346.2z"/>
        <path d="M7790.48 11404.87c27.7,-52.09 136.37,-387.54 154.83,-469.03l276.41 0.93c23.63,78.22 41.32,170.93 61.02,253 15.35,63.93 26.59,227.13 101.56,223.41 90.56,-4.49 26.36,-165.82 9.42,-229.43 -22.35,-83.93 -37.53,-162.48 -60.19,-244.27l79.85 -18.43c29.92,-136.12 -37.41,-117.4 -188.56,-117.48l-289.15 -0.88c-57.65,-123.79 -136.04,-572.15 -170.52,-603.25 -44.06,-39.75 -100.51,-7.22 -104.78,41.87l153.7 619.73c23.2,80.43 28.65,34.65 2.54,122.67 -75.43,254.24 -200,454.55 -26.13,421.17z"/>
        <path d="M8280.84 10503.73c-5.65,38.78 -1.06,53.18 7.22,85.78 66.85,31.18 878.34,14.65 1076.8,15.8 83.05,0.48 66.66,7.23 133.38,-27.24 11.69,-69.26 0.53,-101.16 -72.36,-106.81l-1082.35 1.2c-63.4,9.26 -16.19,4.37 -62.69,31.26z"/>
        <path d="M8844.47 11314.17c-80.66,19.28 -178.23,-34.04 -145.9,92.66 65.17,7.24 163.82,2.72 236.26,3.02 97.12,0.39 179.45,25.45 146.52,-85.1l-142.54 -6.71 -0.26 -648.9 -87.78 -1.92 -6.29 646.95z"/>
      </g>
    </svg>
  );
}

function IconCommercial({ color }) {
  return (
    <svg viewBox="7500 11100 2900 3200" width="68" height="68">
      <g fillRule="evenodd" clipRule="evenodd" fill={color}>
        <path d="M9302.11 13345.35l322.94 -4.3 0.53 691.65 -324.43 -0.49 0.96 -686.87zm-450.52 -0.34l326.85 -4.02 -1.36 691.47 -326.58 -0.41 1.1 -687.04zm-111.04 -116.72c-66.58,126.45 5.72,619.26 -25.67,802.84l-910.1 0 -0.87 -1730.4 2189.61 -4.52 3.91 1736.74 -245.94 -1.02c6.81,-215.91 -2.12,-459.61 0.57,-680.99 2.2,-181.91 13.77,-125.43 -557.23,-130.34 -116.95,-1 -351.6,-13.29 -454.28,7.68zm-1081.03 -927.2l0.18 1729.9c-125.94,7.58 -240.6,-37.86 -204.82,109.91 203.83,26.48 1340.49,8.41 1609.95,9.37l1100 0.7c111.35,0.32 203.24,25.65 173.8,-104.53 -60.37,-22.24 -126.81,-12.07 -203.79,-14.99l1.04 -1730.36c66.61,-21.56 97.32,-27.44 67.36,-189.2 -68.62,-20.11 -2244.35,-8.89 -2488.41,-8.51 -71.8,0.12 -122.61,-12.08 -130.78,66.71 -13.57,130.78 16.98,98.45 75.47,131.01z"/>
        <path d="M8130.98 13335.34l242.4 -4.11 -0.53 234.45 -242.46 2.18 0.59 -232.52zm344.41 312.78c23.61,-37.26 9.6,-163.26 9.7,-217.04 0.11,-57.69 22.93,-177.8 -27.62,-203.27 -32.05,-16.15 -177.34,-8.22 -222.66,-8.08 -256.81,0.76 -218.98,-24.07 -218.71,251.35 0.24,252.28 -54.89,208.18 369.3,209.25 95.2,0.24 78.06,-12.36 89.99,-32.21z"/>
        <path d="M9428.03 12659.39c83.17,0.64 172.48,-9.34 249.8,5.38l0.64 233 -249.74 -0.24 -0.7 -238.15zm-95.26 333.54c44.24,18.89 418.4,37.34 451.81,-14.7 16.15,-71.44 4.83,-241.07 5.46,-327.5 0.91,-125.89 -10.95,-104.33 -245.22,-104.41 -213.41,-0.07 -231.73,-20.75 -229.41,114.68 1.65,96.3 -19.04,255.59 17.36,331.92z"/>
        <path d="M8779.31 12658.74c82.3,1.26 171.21,-8.8 252.16,6.44l-5.15 232.53 -246.23 -0.19 -0.78 -238.78zm-114.15 22.34c0.09,84.23 -9.95,251.14 16.37,312.91 50.06,20.01 380.54,17.37 403.43,12.28 87.02,-19.37 54.86,-138.91 55.19,-265.19 0.62,-239.91 47.02,-192.6 -335.37,-195.02 -131.3,-0.83 -139.77,1.44 -139.62,135.02z"/>
        <path d="M8128.7 12659.67l243.77 1.26 -1.93 232.57 -240.1 -2.37 -1.74 -231.46zm-112.82 -38.59l7.81 362.25c23.12,42.28 177.92,23.97 251.13,24.57 229.5,1.88 211.66,17.61 210.92,-156.82 -0.32,-75.6 7.43,-241.99 -12.23,-297.37 -76.64,-3.48 -318.01,-14.68 -399.29,-6.17 -51.21,5.36 -58.04,20.78 -58.33,73.54z"/>
        <path d="M9554.82 13760.7c55.04,-14.25 48.22,-51.83 33.75,-93.71l-45.98 -7.49c-28.8,113.75 5.54,92.87 12.24,101.2z"/>
      </g>
    </svg>
  );
}

function IconOther({ color }) {
  return (
    <svg viewBox="3300 2300 3300 2600" width="68" height="68">
      <g fillRule="evenodd" clipRule="evenodd" fill={color}>
        <path d="M3684.74 3176.37l1130.08 -722.37c118.55,63.44 826.36,523.42 990.1,628.01 49.56,31.65 97.35,64.74 148.93,86.47l-1139.03 738.36 -1130.08 -730.48zm2386.67 63.67c23.11,-112.6 3.64,-128.17 -78.91,-177.91 -51.81,-31.22 -103.93,-65.12 -159.09,-100.68l-324.26 -205.89c-110.27,-63.44 -210.46,-138.45 -319.54,-200.4l-326.02 -204.26c-77.93,-45.32 -127.35,16.88 -185.7,52.24l-641.84 408.09c-56.41,39.24 -106.13,66.03 -157.2,102.53 -62.91,44.97 -299.41,170.91 -316.5,215.57 -39.07,102.14 37.99,125.95 85.78,159.54 196.85,138.38 432.97,274.88 633.54,416.35l317.92 202.38c299,214.59 200.22,115.25 665.97,-154.55l805.85 -513.01z"/>
        <path d="M3565.32 3971.12c-21.36,149.05 -9.14,124.92 90.94,189.61l1089.81 709.97c31.47,21.22 62,41.46 108.02,20.72l96.09 -64.2c55.1,-40.79 125.89,-84.42 181.96,-118.26l734.07 -475.63c127.07,-72.5 254.08,-130.32 204.83,-237.02 -17.94,-38.87 -178.03,-122.19 -179.05,-122.35 -35.8,-5.59 -80.1,30.65 -101.78,57.1 1.65,2.25 4.41,2.65 5.37,6.41l60.07 43.59 -1040.86 665.89 -1045.51 -665.89c28.96,-32.76 41.96,-10.11 72.61,-66.98 -72.48,-21.35 -59.58,-74.21 -142.07,-18.89 -45.44,30.48 -85.48,61.74 -134.53,75.92z"/>
        <path d="M5775.36 3501.18c49.89,41.85 125.84,71.01 181.39,119.89l-1141.93 742.94 -1137.04 -742.94 136.79 -87.91c2.44,-1.55 24.72,-17.15 24.88,-17.32 23.13,-24.28 2.92,13.25 22.61,-33.99 -115.7,-40.27 -37,-85.82 -217.78,27.91 -46.57,29.3 -76.22,28.92 -86.25,74.78 -24.33,111.23 66.12,134.08 139.18,185.47l501.2 328.59c31.02,19.41 63.06,38.36 96.46,63.37l304.36 195.43c279.72,178.74 176.47,151.98 425,3.85l201.56 -128.27c72.84,-43.67 130.33,-82.67 200.04,-129.89l606.51 -393.14c37.56,-24.87 63.45,-54.01 47.49,-118.38 -14,-56.44 -198.5,-152.11 -198.54,-152.13 -37.47,-8.47 -31.83,-0.74 -58.88,17.9 -22.7,15.64 -33.95,21.17 -47.05,43.84z"/>
        <path d="M4777.93 2964.93l-4.83 42.96c75.67,43.54 98.58,-20.75 68.86,-44.67 -17.67,-5.53 -44.25,-10.94 -64.03,1.71z"/>
        <path d="M4834.82 3649.67c-46.52,-19.63 -78.28,25.27 -51.26,52.44 24.02,24.17 90.57,10.91 51.26,-52.44z"/>
        <path d="M5154.16 2871.02l-0.79 -57.47c-109.05,-12.76 -96.87,74.05 0.79,57.47z"/>
        <path d="M4776.34 2652.13c4.44,103.91 64.72,46.09 65.93,44.24 8.94,-13.68 2.86,5.45 5.36,-15.65 5.55,-46.82 -2.47,-15.73 -6.8,-26.75 -22.42,-9.11 -36.32,-15.27 -64.49,-1.85z"/>
        <path d="M5290.97 2975.58c0.2,30.28 -0.49,54.76 34.02,55.02 48.59,0.37 35.89,-39.44 29.57,-59.48 -21.14,-5.82 -40.84,-13.45 -63.59,4.46z"/>
        <path d="M5617.96 3151.07c-51.36,-39.61 -84.7,-0.49 -62.25,37.05 16.98,28.39 69.06,22.06 62.25,-37.05z"/>
        <path d="M4814.82 3381.02c48.59,-23 44.21,-36.35 19.16,-67.76 -60.5,-1.22 -85.07,41.21 -19.16,67.76z"/>
        <path d="M5276.19 3380.49c14.84,4.37 12.09,10.07 36.85,5.37 27.61,-5.24 28.57,-15.06 38.5,-24.79 -20.86,-65.23 -78.46,-45.26 -75.35,19.42z"/>
        <path d="M4321.27 3368.42l9.43 -52.89c-121.7,-20.34 -77.78,79.69 -9.43,52.89z"/>
        <path d="M4348.7 2967.6c-64.72,-9.58 -82.87,33.09 -51.7,53.87 47.39,31.59 59.71,-19.46 51.7,-53.87z"/>
        <path d="M4608.06 3143.79c-1.66,32.88 -2.35,59.58 36.11,56.61 37.9,-2.93 33.76,-27.58 19.02,-59.24l-55.13 2.63z"/>
        <path d="M5155.12 3503.37c-3.72,-35.09 -7.32,-37.35 -40.3,-49.45 -17.93,13.57 -44.47,29.81 -18.6,55.46 23.68,23.48 46.28,4.27 58.91,-6.01z"/>
        <path d="M4083.92 3188.99c13.22,-39.52 12.64,-7.15 -0.47,-45.4l-18.94 -6.54c-47,2.28 23.11,-14.54 -18.31,1.09 -31.87,12.03 -35.23,77.54 37.71,50.84z"/>
        <path d="M4548.83 3501.07c-13.31,-51.93 -57.09,-47.81 -65.55,-19.24 -13.75,46.45 31.37,49.15 65.55,19.24z"/>
        <path d="M5054.82 3194.44c49.9,1.02 43.66,-4.89 46.55,-51 -44.2,-9.6 -87.25,-4.81 -46.55,51z"/>
        <path d="M4492.43 2830.58c-29.02,34.98 24.86,53 45.63,33.1 11.47,-10.99 16.71,-21.13 1.63,-38.17 -23.65,-26.72 -34.38,-10.45 -47.26,5.07z"/>
      </g>
    </svg>
  );
}

// ---- Progress Bar (main flow) ----
function ProgressBar({ current, total, primaryColor }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="mb-8">
      <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
        Step {current} of {total}
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: primaryColor }} />
      </div>
    </div>
  );
}

// ---- Mini progress (second estimate sub-flow) ----
function MiniProgress({ current, total, primaryColor }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="mb-6">
      <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
        Second Space — Step {current} of {total}
      </div>
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: primaryColor }} />
      </div>
    </div>
  );
}

// ---- Main Component ----
export default function EstimatorV2() {
  const { config, customStyles, useCustomStyles } = useEstimatorConfig();

  // Navigation: 1-5 = main steps, 6 = results, 7-9 = second estimate steps, 10 = combined results
  const [step, setStep] = useState(1);

  // First estimate
  const [projectCategory, setProjectCategory] = useState("");
  const [projectType, setProjectType]         = useState("");
  const [length, setLength]                   = useState("");
  const [width, setWidth]                     = useState("");
  const [squareFeet, setSquareFeet]           = useState("");
  const [sizeMode, setSizeMode]               = useState("dims");
  const [condition, setCondition]             = useState("");
  const [zip, setZip]                         = useState("");
  const [zipError, setZipError]               = useState("");
  const [name, setName]                       = useState("");
  const [email, setEmail]                     = useState("");
  const [phone, setPhone]                     = useState("");
  const [submitting, setSubmitting]           = useState(false);
  const [submitError, setSubmitError]         = useState("");

  // First estimate results
  const [estimate, setEstimate]               = useState(null);
  const [activeFinish, setActiveFinish]       = useState("flake");
  const [companyPhone, setCompanyPhone]       = useState("");
  const [leadId, setLeadId]                   = useState(null);
  const [estimateCount, setEstimateCount]     = useState(0);
  const [showOutOfAreaModal, setShowOutOfAreaModal]     = useState(false);
  const [showTwoEstimatesModal, setShowTwoEstimatesModal] = useState(false);
  const [existingEstimatesForModal, setExistingEstimatesForModal] = useState([]);

  // Second estimate
  const [projectCategory2, setProjectCategory2] = useState("");
  const [projectType2, setProjectType2]         = useState("");
  const [length2, setLength2]                   = useState("");
  const [width2, setWidth2]                     = useState("");
  const [squareFeet2, setSquareFeet2]           = useState("");
  const [sizeMode2, setSizeMode2]               = useState("dims");
  const [condition2, setCondition2]             = useState("");
  const [estimate2, setEstimate2]               = useState(null);
  const [activeFinish2, setActiveFinish2]       = useState("flake");
  const [submitting2, setSubmitting2]           = useState(false);
  const [submitError2, setSubmitError2]         = useState("");

  // ---- Guards ----
  if (!config) return <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>;
  if (config.plan_type === "suspended") {
    return (
      <div className="max-w-lg mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-3">Get an Instant Estimate</h1>
        <p className="text-gray-500">This estimator is temporarily unavailable.</p>
      </div>
    );
  }
  const urlParams = new URLSearchParams(window.location.search);
  const companyId = urlParams.get("company");
  if (!companyId || !config.is_active) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Push Button Marketing for Floor Coating Contractors</h1>
        <a href="https://coatingpro360.com" target="_blank" rel="noopener noreferrer"
          className="text-blue-600 text-lg font-semibold underline">Visit CoatingPro360.com</a>
      </div>
    );
  }

  // ---- Config values ----
  const primaryColor       = config?.selected_button_color       || "#f97316";
  const primaryTextColor   = config?.selected_button_text_color  || "#ffffff";
  const customLabel        = config?.custom_project_label        || "Other";
  const conditionGoodLabel  = config?.condition_good_label       || "Good";
  const conditionMinorLabel = config?.condition_minor_label      || "A Few Cracks";
  const conditionMajorLabel = config?.condition_major_label      || "A Lot of Cracks";
  const customFinishLabel  = config?.custom_finish_label         || "Custom";
  const minJobInfoText     = config?.min_job_info_text           || "Minimum job pricing applied.";
  const standardInfoText   = config?.standard_info_text          || "This is an estimate based on the information provided.";
  const largeProjectSfThresh = config?.large_project_sf_threshold ? Number(config.large_project_sf_threshold) : null;
  const largeProjectNote   = config?.large_project_note          || null;
  const combinedProjectMsg = config?.combined_project_message    || "";
  const cta1Button         = config?.cta1_button                 || "";
  const cta1Link           = config?.cta1_link                   || "";
  const cta2Button         = config?.cta2_button                 || "";
  const cta2Link           = config?.cta2_link                   || "";
  const priceBoxBorderColor  = config?.price_box_border_color    || "#fdba74";
  const pricingInfoBoxBg     = config?.pricing_info_box_background || "#fefce8";
  const pricingInfoBoxStripe = config?.pricing_info_box_stripe_color || "#fb923c";
  const unselectedBtnTextColor = config?.unselected_button_text_color || "#4b5563";

  // ---- Style helpers ----
  const cardClass      = useCustomStyles ? "estimator-card p-6"              : "bg-white rounded-2xl shadow-md p-6";
  const containerClass = useCustomStyles ? "estimator-container mx-auto p-4" : "max-w-lg mx-auto p-4";
  const inputClass     = "w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400 transition-colors";
  const primaryBtnStyle  = { backgroundColor: primaryColor, color: primaryTextColor, cursor: "pointer" };
  const disabledBtnStyle = { backgroundColor: "#e5e7eb", color: "#9ca3af", cursor: "not-allowed" };
  const hoverOn  = (e) => { e.currentTarget.style.borderColor = primaryColor; e.currentTarget.style.backgroundColor = primaryColor + "14"; };
  const hoverOff = (e) => { e.currentTarget.style.borderColor = "#e5e7eb";   e.currentTarget.style.backgroundColor = "#ffffff"; };

  // ---- Step data ----
  const anyGarage = [1,2,3,4].some(n => config[`allow_garage_${n}`] !== false);
  const step1Types = [
    anyGarage                         && { key: "garage",      label: "Garage",          Icon: IconGarage },
    config.allow_basement !== false   && { key: "basement",    label: "Basement",        Icon: IconBasement },
    config.allow_patio !== false      && { key: "patio",       label: "Patio / Outdoor", Icon: IconPatio },
    config.allow_commercial !== false && { key: "commercial",  label: "Commercial",      Icon: IconCommercial },
    config.allow_custom !== false     && { key: "custom",      label: customLabel,       Icon: IconOther },
  ].filter(Boolean);

  const garageSizes = [
    config.allow_garage_2 !== false && { key: "garage_2", label: "2 Car Garage" },
    config.allow_garage_3 !== false && { key: "garage_3", label: "3 Car Garage" },
    config.allow_garage_4 !== false && { key: "garage_4", label: "4 Car Garage" },
  ].filter(Boolean);

  const conditionOptions = [
    { value: "none",  label: conditionGoodLabel,  sub: "Little to no cracking" },
    { value: "minor", label: conditionMinorLabel, sub: "Some surface cracks present" },
    { value: "major", label: conditionMajorLabel, sub: "Significant cracking throughout" },
  ];

  // ---- Derived / validation ----
  const isCommercial  = projectCategory  === "commercial";
  const isCommercial2 = projectCategory2 === "commercial";
  const step2Valid = isCommercial
    ? Number(squareFeet) > 0
    : sizeMode === "dims" ? (Number(length) > 0 && Number(width) > 0) : Number(squareFeet) > 0;
  const step8Valid = isCommercial2
    ? Number(squareFeet2) > 0
    : sizeMode2 === "dims" ? (Number(length2) > 0 && Number(width2) > 0) : Number(squareFeet2) > 0;
  const step5Valid = name.trim() && validEmail(email) && validPhone(phone);

  function getSpaceLabel(cat) {
    return { basement: "your basement", patio: "your patio or outdoor space",
      commercial: "your commercial space", custom: `your ${customLabel.toLowerCase()}` }[cat] || "your space";
  }

  // ---- Project label helper ----
  function buildProjectLabel(pt, l, w, sf) {
    if (!pt) return "";
    if (pt.startsWith("garage_")) return pt.split("_")[1] + " car garage";
    if (["patio", "basement"].includes(pt)) {
      if (Number(l) > 0 && Number(w) > 0) return `${l}' × ${w}' ${pt}`;
      if (Number(sf) > 0) return `${Number(sf).toLocaleString()} sq ft ${pt}`;
      return pt;
    }
    if (pt === "commercial")
      return Number(sf) > 0 ? `Commercial space (${Number(sf).toLocaleString()} sq ft)` : "Commercial space";
    if (pt === "custom") {
      const cp = config?.custom_project_label || "Other Project";
      if (Number(l) > 0 && Number(w) > 0) return `${l}' × ${w}' ${cp}`;
      if (Number(sf) > 0) return `${Number(sf).toLocaleString()} sq ft ${cp}`;
      return cp;
    }
    return pt;
  }

  function getConditionLabel(c) {
    if (c === "minor") return conditionMinorLabel;
    if (c === "major") return conditionMajorLabel;
    return conditionGoodLabel;
  }

  function getFinishLabel(f) {
    return f === "custom" ? customFinishLabel : f.charAt(0).toUpperCase() + f.slice(1);
  }

  function getPriceDisplay(ranges, finish) {
    const r = ranges?.[finish];
    if (!r) return "—";
    return r.min === r.max
      ? `$${r.min.toLocaleString()}`
      : `$${r.min.toLocaleString()} – $${r.max.toLocaleString()}`;
  }

  // ---- First estimate submit ----
  async function handleSubmit() {
    if (!step5Valid || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    const serviceZips = config?.service_area_zips;
    const isOutsideArea = serviceZips && Array.isArray(serviceZips) && serviceZips.length > 0
      && !serviceZips.map(String).includes(zip.trim());
    try {
      const previewRes = await fetch(`${API_BASE}/estimator/preview`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId, project: { type: projectType, condition },
          length, width, squareFeet, selectedQuality: activeFinish, zip }),
      });
      const previewData = await previewRes.json();
      if (!previewRes.ok) throw new Error(previewData.error || "Unable to generate estimate");
      if (previewData.estimate?.selectedQuality) setActiveFinish(previewData.estimate.selectedQuality);

      let outOfAreaLargeJob = false;
      if (isOutsideArea && config?.out_of_area_enabled) {
        const flakeMin = previewData.estimate?.allPriceRanges?.flake?.min || previewData.estimate?.displayPriceMin || 0;
        const threshold = Number(config.out_of_area_large_job_threshold) || 0;
        if (threshold > 0 && flakeMin < threshold) {
          setSubmitError(config?.out_of_area_sorry_message || "Thank you for your interest. This project appears to be outside our normal service area.");
          fetch(`${API_BASE}/estimator/out-of-area-log`, { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ company_id: companyId, homeowner_name: name, zip_code: zip, estimated_value: flakeMin, status: "outside_area_below_threshold" }) }).catch(() => {});
          return;
        }
        outOfAreaLargeJob = true;
      }

      const leadData = {
        company_id: companyId, name, email, phone, zip, project_type: projectType,
        lead_source: "estimator", referral_source: "estimator", status: "status_pre_lead",
        utm_source: _utmSource, utm_medium: _utmMedium, utm_campaign: _utmCampaign,
        out_of_area_large_job: outOfAreaLargeJob,
        estimate: {
          project_type: projectType, length_ft: length ? parseFloat(length) : null,
          width_ft: width ? parseFloat(width) : null, calculated_sf: previewData.estimate.calculatedSf,
          condition, existing_coating: false, selected_quality: activeFinish,
          display_price_min: previewData.estimate.displayPriceMin, display_price_max: previewData.estimate.displayPriceMax,
          all_price_ranges: previewData.estimate.allPriceRanges, minimum_job_applied: previewData.estimate.minimumJobApplied || false,
        },
      };

      const leadRes = await fetch(`${API_BASE}/leads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(leadData) });
      const leadText = await leadRes.text();
      let leadResData;
      try { leadResData = JSON.parse(leadText); } catch { throw new Error("Lead API did not return JSON"); }
      if (!leadRes.ok) throw new Error(leadResData.error || "Failed to create lead");

      try { if (config.google_conversion_event) new Function(config.google_conversion_event)(); } catch {}
      try { if (config.meta_conversion_event && typeof fbq === "function") new Function(config.meta_conversion_event)(); } catch {}
      try { if (typeof gtag === "function") gtag("event", "estimate_submitted"); } catch {}
      try { window.parent.postMessage({ event: "estimator_conversion", type: "estimate_submitted", microsoftEventCode: config.microsoft_conversion_event || null }, "*"); } catch {}

      if (leadResData?.lead?.id) setLeadId(leadResData.lead.id);
      setCompanyPhone(previewData.companyPhone || "");

      if (outOfAreaLargeJob) {
        const flakeMin = previewData.estimate?.allPriceRanges?.flake?.min || previewData.estimate?.displayPriceMin || 0;
        fetch(`${API_BASE}/estimator/out-of-area-log`, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company_id: companyId, homeowner_name: name, zip_code: zip, estimated_value: flakeMin, status: "outside_area_large_job_submitted" }) }).catch(() => {});
        setShowOutOfAreaModal(true);
      }

      if (leadResData?.twoEstimatesExist) {
        setExistingEstimatesForModal(leadResData.estimates || []);
        setShowTwoEstimatesModal(true);
        return;
      }

      setEstimate(previewData.estimate);
      setEstimateCount(leadResData?.estimates?.length || 1);
      setStep(6);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Second estimate submit ----
  async function handleSecondEstimate(selectedCondition) {
    setSubmitting2(true);
    setSubmitError2("");
    try {
      const previewRes = await fetch(`${API_BASE}/estimator/preview`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId, project: { type: projectType2, condition: selectedCondition },
          length: length2, width: width2, squareFeet: squareFeet2, selectedQuality: activeFinish, zip }),
      });
      const previewData = await previewRes.json();
      if (!previewRes.ok) throw new Error(previewData.error || "Unable to generate estimate");
      if (previewData.estimate?.selectedQuality) setActiveFinish2(previewData.estimate.selectedQuality);

      const saveRes = await fetch(`${API_BASE}/leads/${leadId}/second-estimate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_type: projectType2, condition: selectedCondition,
          length_ft: length2 ? parseFloat(length2) : null, width_ft: width2 ? parseFloat(width2) : null,
          calculated_sf: previewData.estimate.calculatedSf, existing_coating: false, selected_quality: activeFinish,
          display_price_min: previewData.estimate.displayPriceMin, display_price_max: previewData.estimate.displayPriceMax,
          all_price_ranges: previewData.estimate.allPriceRanges, minimum_job_applied: previewData.estimate.minimumJobApplied || false,
        }),
      });
      if (!saveRes.ok) {
        const errData = await saveRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to save second estimate");
      }

      setEstimate2(previewData.estimate);
      setEstimateCount(2);
      setStep(10);
    } catch (err) {
      setSubmitError2(err.message);
    } finally {
      setSubmitting2(false);
    }
  }

  // ---- Results derived values ----
  const finishTabs = ["solid", "flake", "metallic", "custom"];
  const allRanges1 = estimate?.allPriceRanges  || {};
  const allRanges2 = estimate2?.allPriceRanges || {};
  const r1 = allRanges1[activeFinish];
  const r2 = allRanges2[activeFinish2];
  const infoBoxStyle = { backgroundColor: pricingInfoBoxBg, borderLeft: `4px solid ${pricingInfoBoxStripe}` };

  function getInfoText(est, finish) {
    const range = est?.allPriceRanges?.[finish];
    const minApplied = range?.minimumApplied && range?.min === range?.max;
    if (minApplied) return minJobInfoText;
    const isLarge = largeProjectSfThresh && est?.calculatedSf >= largeProjectSfThresh;
    if (isLarge && largeProjectNote) return largeProjectNote;
    return standardInfoText;
  }

  function FinishTabs({ ranges, active, setActive }) {
    return (
      <div className="flex justify-center gap-1">
        {finishTabs.map((f) => {
          if (!ranges[f]) return null;
          const isActive = active === f;
          return (
            <button key={f} type="button" onClick={() => setActive(f)}
              className="px-4 py-2 text-sm font-semibold rounded-t-xl border transition-all"
              style={isActive
                ? { backgroundColor: "#ffffff", color: "#111827", borderColor: priceBoxBorderColor, borderBottomColor: "transparent" }
                : { backgroundColor: "#f3f4f6", color: unselectedBtnTextColor, borderColor: "#d1d5db", borderBottomColor: priceBoxBorderColor }
              }
            >{getFinishLabel(f)}</button>
          );
        })}
      </div>
    );
  }

  // ============================================================
  return (
    <>
      {useCustomStyles && <style>{customStyles}</style>}
      <div className={containerClass}>
        <div className={cardClass}>

          {/* ══════════ STEP 1: Project Type ══════════ */}
          {step === 1 && (
            <div>
              <ProgressBar current={1} total={TOTAL_STEPS} primaryColor={primaryColor} />
              <h2 className="text-2xl font-bold text-center mb-1">What type of space?</h2>
              <p className="text-gray-400 text-sm text-center mb-8">Select the area you'd like to have coated</p>
              <div className="grid grid-cols-2 gap-4">
                {step1Types.map(({ key, label, Icon }, index) => {
                  const spanFull = index === step1Types.length - 1 && step1Types.length % 2 !== 0;
                  return (
                    <button key={key} type="button"
                      onClick={() => { setProjectCategory(key); setStep(2); }}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 py-5 px-3 font-semibold text-xs transition-all duration-150 cursor-pointer${spanFull ? " col-span-2" : ""}`}
                      style={{ borderColor: "#e5e7eb", backgroundColor: "#ffffff", color: "#374151" }}
                      onMouseEnter={hoverOn} onMouseLeave={hoverOff}
                    >
                      <Icon color={primaryColor} />
                      <span className="leading-tight text-center">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══════════ STEP 2: Size ══════════ */}
          {step === 2 && (
            <div>
              <ProgressBar current={2} total={TOTAL_STEPS} primaryColor={primaryColor} />
              <button type="button"
                onClick={() => { setStep(1); setProjectCategory(""); setProjectType(""); setLength(""); setWidth(""); setSquareFeet(""); setSizeMode("dims"); }}
                className="text-sm font-semibold mb-6 inline-flex items-center" style={{ color: primaryColor }}>← Back</button>

              {projectCategory === "garage" ? (
                <>
                  <h2 className="text-2xl font-bold text-center mb-1">How big is your garage?</h2>
                  <p className="text-gray-400 text-sm text-center mb-8">Select the size that best fits</p>
                  <div className="flex flex-col gap-4">
                    {garageSizes.map(({ key, label }) => (
                      <button key={key} type="button"
                        onClick={() => { setProjectType(key); setLength(""); setWidth(""); setSquareFeet(""); setStep(3); }}
                        className="flex items-center justify-center rounded-2xl border-2 py-6 px-4 font-semibold text-base w-full transition-all duration-150"
                        style={{ borderColor: "#e5e7eb", backgroundColor: "#ffffff", color: "#374151" }}
                        onMouseEnter={hoverOn} onMouseLeave={hoverOff}
                      >{label}</button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-center mb-1">How big is {getSpaceLabel(projectCategory)}?</h2>
                  <p className="text-gray-400 text-sm text-center mb-8">We use this to calculate your estimate</p>
                  {isCommercial ? (
                    <>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">Square Footage</label>
                      <input type="number" className={inputClass} placeholder="e.g. 2000"
                        value={squareFeet} onChange={(e) => setSquareFeet(e.target.value)} />
                    </>
                  ) : (
                    <>
                      <div className="flex gap-2 mb-6">
                        {[{ mode: "dims", label: "Length × Width" }, { mode: "sf", label: "Square Footage" }].map(({ mode, label }) => {
                          const active = sizeMode === mode;
                          return (
                            <button key={mode} type="button"
                              onClick={() => { setSizeMode(mode); if (mode === "dims") setSquareFeet(""); else { setLength(""); setWidth(""); } }}
                              className="flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all"
                              style={{ borderColor: active ? primaryColor : "#e5e7eb", backgroundColor: active ? primaryColor : "#ffffff", color: active ? primaryTextColor : "#6b7280" }}
                            >{label}</button>
                          );
                        })}
                      </div>
                      {sizeMode === "dims" ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-2">Length (ft)</label>
                            <input type="number" className={inputClass} placeholder="e.g. 20" value={length} onChange={(e) => setLength(e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-2">Width (ft)</label>
                            <input type="number" className={inputClass} placeholder="e.g. 20" value={width} onChange={(e) => setWidth(e.target.value)} />
                          </div>
                        </div>
                      ) : (
                        <>
                          <label className="block text-sm font-semibold text-gray-600 mb-2">Square Footage</label>
                          <input type="number" className={inputClass} placeholder="e.g. 400" value={squareFeet} onChange={(e) => setSquareFeet(e.target.value)} />
                        </>
                      )}
                    </>
                  )}
                  <button type="button" disabled={!step2Valid}
                    onClick={() => { if (!step2Valid) return; setProjectType(projectCategory); setStep(3); }}
                    className="w-full font-bold py-4 rounded-2xl mt-8 text-base transition-all"
                    style={step2Valid ? primaryBtnStyle : disabledBtnStyle}
                  >Next →</button>
                </>
              )}
            </div>
          )}

          {/* ══════════ STEP 3: Concrete Condition ══════════ */}
          {step === 3 && (
            <div>
              <ProgressBar current={3} total={TOTAL_STEPS} primaryColor={primaryColor} />
              <button type="button" onClick={() => { setStep(2); setCondition(""); }}
                className="text-sm font-semibold mb-6 inline-flex items-center" style={{ color: primaryColor }}>← Back</button>
              <h2 className="text-2xl font-bold text-center mb-1">Condition of the concrete?</h2>
              <p className="text-gray-400 text-sm text-center mb-8">This helps us estimate any prep work needed</p>
              <div className="flex flex-col gap-4">
                {conditionOptions.map(({ value, label, sub }) => (
                  <button key={value} type="button"
                    onClick={() => { setCondition(value); setStep(4); }}
                    className="flex flex-col items-start rounded-2xl border-2 py-5 px-5 w-full text-left transition-all duration-150"
                    style={{ borderColor: "#e5e7eb", backgroundColor: "#ffffff", color: "#374151" }}
                    onMouseEnter={hoverOn} onMouseLeave={hoverOff}
                  >
                    <span className="font-semibold text-base">{label}</span>
                    <span className="text-sm text-gray-400 mt-0.5">{sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ══════════ STEP 4: ZIP Code ══════════ */}
          {step === 4 && (
            <div>
              <ProgressBar current={4} total={TOTAL_STEPS} primaryColor={primaryColor} />
              <button type="button" onClick={() => { setStep(3); setZip(""); setZipError(""); }}
                className="text-sm font-semibold mb-6 inline-flex items-center" style={{ color: primaryColor }}>← Back</button>
              <h2 className="text-2xl font-bold text-center mb-1">What's your project ZIP code?</h2>
              <p className="text-gray-400 text-sm text-center mb-8">We use this to confirm we service your area</p>
              <label className="block text-sm font-semibold text-gray-600 mb-2">ZIP Code</label>
              <input type="text" inputMode="numeric" maxLength={5}
                className={`w-full border-2 rounded-xl px-4 py-3 text-lg font-semibold text-center tracking-widest focus:outline-none transition-colors ${zipError ? "border-red-400" : "border-gray-200 focus:border-orange-400"}`}
                placeholder="e.g. 30301" value={zip}
                onChange={(e) => { setZip(e.target.value.replace(/\D/g, "").slice(0, 5)); setZipError(""); }}
              />
              {zipError && <div className="mt-3 bg-red-50 border-l-4 border-red-400 rounded-md px-4 py-3 text-sm text-red-700">{zipError}</div>}
              <button type="button" disabled={zip.length < 5}
                onClick={() => {
                  const serviceZips = config?.service_area_zips;
                  const isOutside = serviceZips && Array.isArray(serviceZips) && serviceZips.length > 0
                    && !serviceZips.map(String).includes(zip.trim());
                  if (isOutside && !config?.out_of_area_enabled) {
                    setZipError(`Sorry, we don't currently service ZIP code ${zip}. Please contact us to learn more.`);
                    return;
                  }
                  setStep(5);
                }}
                className="w-full font-bold py-4 rounded-2xl mt-6 text-base transition-all"
                style={zip.length === 5 ? primaryBtnStyle : disabledBtnStyle}
              >Next →</button>
            </div>
          )}

          {/* ══════════ STEP 5: Contact Details ══════════ */}
          {step === 5 && (
            <div>
              <ProgressBar current={5} total={TOTAL_STEPS} primaryColor={primaryColor} />
              <button type="button" onClick={() => { setStep(4); setSubmitError(""); }}
                className="text-sm font-semibold mb-6 inline-flex items-center" style={{ color: primaryColor }}>← Back</button>
              <h2 className="text-2xl font-bold text-center mb-1">Almost there!</h2>
              <p className="text-gray-400 text-sm text-center mb-8">Enter your info to see your instant estimate</p>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2">Full Name</label>
                  <input type="text" className={inputClass} placeholder="Jane Smith" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2">Email Address</label>
                  <input type="email" className={inputClass} placeholder="jane@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2">Phone Number</label>
                  <input type="tel" className={inputClass} placeholder="(555) 555-5555" value={phone} onChange={(e) => setPhone(formatPhoneNumber(e.target.value))} />
                </div>
              </div>
              {submitError && <div className="mt-4 bg-red-50 border-l-4 border-red-400 rounded-md px-4 py-3 text-sm text-red-700">{submitError}</div>}
              <button type="button" disabled={!step5Valid || submitting} onClick={handleSubmit}
                className="w-full font-bold py-4 rounded-2xl mt-6 text-base transition-all"
                style={step5Valid && !submitting ? primaryBtnStyle : disabledBtnStyle}
              >{submitting ? "Calculating your estimate..." : "See My Estimate →"}</button>
            </div>
          )}

          {/* ══════════ STEP 6: Results ══════════ */}
          {step === 6 && estimate && (
            <div>
              <h2 className="text-2xl font-bold text-center mb-6">Your Estimated Price</h2>
              <FinishTabs ranges={allRanges1} active={activeFinish} setActive={setActiveFinish} />
              <div className="rounded-xl overflow-hidden text-center p-6 space-y-2" style={{ border: `1px solid ${priceBoxBorderColor}`, marginTop: "-1px" }}>
                <div className="text-lg font-semibold text-gray-700">{buildProjectLabel(projectType, length, width, squareFeet)}</div>
                <div className="text-3xl font-bold">{getPriceDisplay(allRanges1, activeFinish)}<span className="text-sm align-super">*</span></div>
                <div className="text-sm text-gray-600">Concrete condition: <strong>{getConditionLabel(condition)}</strong></div>
                {config?.[`${activeFinish}_finish_description`] && (
                  <div className="text-sm text-gray-600 pt-1">{renderTextWithInlineLinks(String(config[`${activeFinish}_finish_description`]))}</div>
                )}
              </div>
              {getInfoText(estimate, activeFinish) && (
                <div className="rounded-md px-4 py-3 text-sm mt-3" style={infoBoxStyle}>* {getInfoText(estimate, activeFinish)}</div>
              )}
              {(cta1Button || cta2Button) && (
                <div className="flex flex-col gap-3 mt-6">
                  {cta1Button && cta1Link && <a href={cta1Link} className="block w-full text-center font-bold py-4 rounded-2xl text-base" style={primaryBtnStyle}>{cta1Button}</a>}
                  {cta2Button && cta2Link && <a href={cta2Link} className="block w-full text-center font-bold py-4 rounded-2xl text-base" style={primaryBtnStyle}>{cta2Button}</a>}
                </div>
              )}
              {estimateCount < 2 && leadId && (
                <div className="mt-6 pt-5 border-t border-gray-100 text-center">
                  <p className="text-sm text-gray-400 mb-2">Have another space you'd like estimated?</p>
                  <button type="button"
                    onClick={() => { setProjectCategory2(""); setProjectType2(""); setLength2(""); setWidth2(""); setSquareFeet2(""); setSizeMode2("dims"); setCondition2(""); setStep(7); }}
                    className="font-semibold text-sm py-2 px-5 rounded-xl border-2 transition-all"
                    style={{ borderColor: primaryColor, color: primaryColor, backgroundColor: "transparent" }}
                  >+ Add a Second Estimate</button>
                </div>
              )}
              {estimateCount >= 2 && (
                <p className="text-sm text-gray-400 text-center mt-4">You have 2 estimates on file. Call us if you need additional areas quoted.</p>
              )}
            </div>
          )}

          {/* ══════════ STEP 7: Second Estimate — Project Type ══════════ */}
          {step === 7 && (
            <div>
              <MiniProgress current={1} total={3} primaryColor={primaryColor} />
              <button type="button" onClick={() => setStep(6)}
                className="text-sm font-semibold mb-6 inline-flex items-center" style={{ color: primaryColor }}>← Back to My Estimate</button>
              <h2 className="text-2xl font-bold text-center mb-1">What's the second space?</h2>
              <p className="text-gray-400 text-sm text-center mb-8">Select the type of area you'd like coated</p>
              <div className="grid grid-cols-2 gap-4">
                {step1Types.map(({ key, label, Icon }, index) => {
                  const spanFull = index === step1Types.length - 1 && step1Types.length % 2 !== 0;
                  return (
                    <button key={key} type="button"
                      onClick={() => { setProjectCategory2(key); setStep(8); }}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 py-5 px-3 font-semibold text-xs transition-all duration-150 cursor-pointer${spanFull ? " col-span-2" : ""}`}
                      style={{ borderColor: "#e5e7eb", backgroundColor: "#ffffff", color: "#374151" }}
                      onMouseEnter={hoverOn} onMouseLeave={hoverOff}
                    >
                      <Icon color={primaryColor} />
                      <span className="leading-tight text-center">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══════════ STEP 8: Second Estimate — Size ══════════ */}
          {step === 8 && (
            <div>
              <MiniProgress current={2} total={3} primaryColor={primaryColor} />
              <button type="button"
                onClick={() => { setStep(7); setProjectCategory2(""); setProjectType2(""); setLength2(""); setWidth2(""); setSquareFeet2(""); setSizeMode2("dims"); }}
                className="text-sm font-semibold mb-6 inline-flex items-center" style={{ color: primaryColor }}>← Back</button>

              {projectCategory2 === "garage" ? (
                <>
                  <h2 className="text-2xl font-bold text-center mb-1">How big is the garage?</h2>
                  <p className="text-gray-400 text-sm text-center mb-8">Select the size that best fits</p>
                  <div className="flex flex-col gap-4">
                    {garageSizes.map(({ key, label }) => (
                      <button key={key} type="button"
                        onClick={() => { setProjectType2(key); setLength2(""); setWidth2(""); setSquareFeet2(""); setStep(9); }}
                        className="flex items-center justify-center rounded-2xl border-2 py-6 px-4 font-semibold text-base w-full transition-all duration-150"
                        style={{ borderColor: "#e5e7eb", backgroundColor: "#ffffff", color: "#374151" }}
                        onMouseEnter={hoverOn} onMouseLeave={hoverOff}
                      >{label}</button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-center mb-1">How big is {getSpaceLabel(projectCategory2)}?</h2>
                  <p className="text-gray-400 text-sm text-center mb-8">We use this to calculate your estimate</p>
                  {isCommercial2 ? (
                    <>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">Square Footage</label>
                      <input type="number" className={inputClass} placeholder="e.g. 2000" value={squareFeet2} onChange={(e) => setSquareFeet2(e.target.value)} />
                    </>
                  ) : (
                    <>
                      <div className="flex gap-2 mb-6">
                        {[{ mode: "dims", label: "Length × Width" }, { mode: "sf", label: "Square Footage" }].map(({ mode, label }) => {
                          const active = sizeMode2 === mode;
                          return (
                            <button key={mode} type="button"
                              onClick={() => { setSizeMode2(mode); if (mode === "dims") setSquareFeet2(""); else { setLength2(""); setWidth2(""); } }}
                              className="flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all"
                              style={{ borderColor: active ? primaryColor : "#e5e7eb", backgroundColor: active ? primaryColor : "#ffffff", color: active ? primaryTextColor : "#6b7280" }}
                            >{label}</button>
                          );
                        })}
                      </div>
                      {sizeMode2 === "dims" ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-2">Length (ft)</label>
                            <input type="number" className={inputClass} placeholder="e.g. 20" value={length2} onChange={(e) => setLength2(e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-2">Width (ft)</label>
                            <input type="number" className={inputClass} placeholder="e.g. 20" value={width2} onChange={(e) => setWidth2(e.target.value)} />
                          </div>
                        </div>
                      ) : (
                        <>
                          <label className="block text-sm font-semibold text-gray-600 mb-2">Square Footage</label>
                          <input type="number" className={inputClass} placeholder="e.g. 400" value={squareFeet2} onChange={(e) => setSquareFeet2(e.target.value)} />
                        </>
                      )}
                    </>
                  )}
                  <button type="button" disabled={!step8Valid}
                    onClick={() => { if (!step8Valid) return; setProjectType2(projectCategory2); setStep(9); }}
                    className="w-full font-bold py-4 rounded-2xl mt-8 text-base transition-all"
                    style={step8Valid ? primaryBtnStyle : disabledBtnStyle}
                  >Next →</button>
                </>
              )}
            </div>
          )}

          {/* ══════════ STEP 9: Second Estimate — Condition ══════════ */}
          {step === 9 && (
            <div>
              <MiniProgress current={3} total={3} primaryColor={primaryColor} />
              <button type="button" onClick={() => { setStep(8); setCondition2(""); }}
                className="text-sm font-semibold mb-6 inline-flex items-center" style={{ color: primaryColor }}>← Back</button>
              <h2 className="text-2xl font-bold text-center mb-1">Condition of this concrete?</h2>
              <p className="text-gray-400 text-sm text-center mb-8">For the second space</p>
              {submitError2 && <div className="mb-4 bg-red-50 border-l-4 border-red-400 rounded-md px-4 py-3 text-sm text-red-700">{submitError2}</div>}
              {submitting2 ? (
                <div className="text-center py-10 text-gray-400 font-semibold">Calculating your second estimate...</div>
              ) : (
                <div className="flex flex-col gap-4">
                  {conditionOptions.map(({ value, label, sub }) => (
                    <button key={value} type="button"
                      onClick={() => { setCondition2(value); handleSecondEstimate(value); }}
                      className="flex flex-col items-start rounded-2xl border-2 py-5 px-5 w-full text-left transition-all duration-150"
                      style={{ borderColor: "#e5e7eb", backgroundColor: "#ffffff", color: "#374151" }}
                      onMouseEnter={hoverOn} onMouseLeave={hoverOff}
                    >
                      <span className="font-semibold text-base">{label}</span>
                      <span className="text-sm text-gray-400 mt-0.5">{sub}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════ STEP 10: Combined Results ══════════ */}
          {step === 10 && estimate && estimate2 && (
            <div>
              <h2 className="text-2xl font-bold text-center mb-6">Your 2 Estimates</h2>

              {/* Estimate 1 */}
              <div className="mb-3">
                <FinishTabs ranges={allRanges1} active={activeFinish} setActive={setActiveFinish} />
                <div className="rounded-xl overflow-hidden text-center px-5 py-4 space-y-1" style={{ border: `1px solid ${priceBoxBorderColor}`, marginTop: "-1px" }}>
                  <div className="text-sm font-semibold text-gray-500">{buildProjectLabel(projectType, length, width, squareFeet)}</div>
                  <div className="text-2xl font-bold">{getPriceDisplay(allRanges1, activeFinish)}<span className="text-xs align-super">*</span></div>
                  <div className="text-xs text-gray-500">Condition: {getConditionLabel(condition)}</div>
                  {r1?.minimumApplied && r1?.min === r1?.max && <p className="text-xs text-gray-400 italic">{minJobInfoText}</p>}
                </div>
              </div>

              {/* Estimate 2 */}
              <div className="mb-5">
                <FinishTabs ranges={allRanges2} active={activeFinish2} setActive={setActiveFinish2} />
                <div className="rounded-xl overflow-hidden text-center px-5 py-4 space-y-1" style={{ border: `1px solid ${priceBoxBorderColor}`, marginTop: "-1px" }}>
                  <div className="text-sm font-semibold text-gray-500">{buildProjectLabel(projectType2, length2, width2, squareFeet2)}</div>
                  <div className="text-2xl font-bold">{getPriceDisplay(allRanges2, activeFinish2)}<span className="text-xs align-super">*</span></div>
                  <div className="text-xs text-gray-500">Condition: {getConditionLabel(condition2)}</div>
                  {r2?.minimumApplied && r2?.min === r2?.max && <p className="text-xs text-gray-400 italic">{minJobInfoText}</p>}
                </div>
              </div>

              {/* Combined total */}
              {r1 && r2 && (
                <div className="text-center mb-4">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Combined Total</div>
                  <div className="text-3xl font-bold">
                    {(r1.min + r2.min) === (r1.max + r2.max)
                      ? `$${(r1.min + r2.min).toLocaleString()}`
                      : `$${(r1.min + r2.min).toLocaleString()} – $${(r1.max + r2.max).toLocaleString()}`
                    }
                  </div>
                  {(r1?.minimumApplied || r2?.minimumApplied) && (
                    <p className="text-xs text-gray-400 italic mt-1">{minJobInfoText}</p>
                  )}
                </div>
              )}

              {/* Combined project message */}
              {combinedProjectMsg && (
                <div className="rounded-md px-4 py-3 text-sm mb-4" style={infoBoxStyle}>{combinedProjectMsg}</div>
              )}

              {/* CTAs */}
              {(cta1Button || cta2Button) && (
                <div className="flex flex-col gap-3 mt-2">
                  {cta1Button && cta1Link && <a href={cta1Link} className="block w-full text-center font-bold py-4 rounded-2xl text-base" style={primaryBtnStyle}>{cta1Button}</a>}
                  {cta2Button && cta2Link && <a href={cta2Link} className="block w-full text-center font-bold py-4 rounded-2xl text-base" style={primaryBtnStyle}>{cta2Button}</a>}
                </div>
              )}

              <p className="text-xs text-gray-400 italic text-center mt-4">* {standardInfoText}</p>
            </div>
          )}

        </div>
      </div>

      {/* Out-of-area large job modal */}
      {showOutOfAreaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
            <div className="text-4xl mb-4">🧭</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Outside Our Normal Service Area</h2>
            <p className="text-gray-600 mb-6 text-sm">{config?.out_of_area_large_job_message || "You are outside our normal service area, but this project may still be worth reviewing. We'll be in touch!"}</p>
            <button onClick={() => setShowOutOfAreaModal(false)} className="px-6 py-2 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-700">Got It — Show My Estimate</button>
          </div>
        </div>
      )}

      {/* Two estimates modal */}
      {showTwoEstimatesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
            <div className="text-4xl mb-4">📋</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">You Already Have 2 Estimates</h2>
            <p className="text-gray-600 mb-6 text-sm">Here are the estimates we have on file. Call us if you need additional areas quoted.</p>
            <div className="space-y-3 text-left mb-6">
              {existingEstimatesForModal.map((est, idx) => {
                let pr = {};
                try { pr = typeof est.all_price_ranges === "string" ? JSON.parse(est.all_price_ranges) : est.all_price_ranges || {}; } catch {}
                const flake = pr.flake || {};
                const min = flake.min || est.display_price_min;
                const max = flake.max || est.display_price_max;
                return (
                  <div key={est.id || idx} className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-1">{est.project_type}</div>
                    <div className="font-bold text-gray-900">{min && max ? `$${Number(min).toLocaleString()} – $${Number(max).toLocaleString()}` : "N/A"}</div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setShowTwoEstimatesModal(false)} className="px-6 py-2 text-gray-500 text-sm font-semibold hover:text-gray-700">Close</button>
          </div>
        </div>
      )}
    </>
  );
}
