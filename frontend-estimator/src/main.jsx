import React from "react";
import ReactDOM from "react-dom/client";
import Estimator from "./estimator/Estimator.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Estimator />
  </React.StrictMode>
);
// Send scroll height to parent whenever content changes (for iframe auto-sizing)
function sendCp360Height() {
  window.parent.postMessage({ cp360Height: document.documentElement.scrollHeight }, "*");
}

if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(sendCp360Height).observe(document.documentElement);
} else {
  window.addEventListener("resize", sendCp360Height);
  setInterval(sendCp360Height, 500);
}
window.addEventListener("load", sendCp360Height);

