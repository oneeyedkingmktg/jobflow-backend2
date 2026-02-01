import React from "react";
import ReactDOM from "react-dom/client";
import Estimator from "./estimator/Estimator.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Estimator />
  </React.StrictMode>
);
// ============================================================
// CP360 iframe auto-height support
// ============================================================
function sendCp360Height() {
  const height = document.documentElement.scrollHeight;
  window.parent.postMessage({ cp360Height: height }, "*");
}

window.addEventListener("load", sendCp360Height);
window.addEventListener("resize", sendCp360Height);

// Re-fire for dynamic UI changes (steps, validation, results)
setInterval(sendCp360Height, 500);

