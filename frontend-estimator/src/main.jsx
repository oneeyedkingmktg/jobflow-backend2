import React from "react";
import ReactDOM from "react-dom/client";
import Estimator from "./estimator/Estimator.jsx";
import EstimatorV2 from "./estimator/v2/EstimatorV2.jsx";
import Visualizer from "./visualizer/Visualizer.jsx";
import "./index.css";

const _v2Params = new URLSearchParams(window.location.search);
const _mode = _v2Params.get("mode");
let Component;
if (_mode === "visualizer") Component = Visualizer;
else if (_v2Params.get("v") === "2") Component = EstimatorV2;
else Component = Estimator;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Component />
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

