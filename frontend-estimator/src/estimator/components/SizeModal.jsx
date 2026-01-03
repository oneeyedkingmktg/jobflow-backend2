// ============================================================================
// Size Modal Component
// File: estimator/components/SizeModal.jsx
// Version: v2.1.0 - Added primary button styling from config
// ============================================================================

export default function SizeModal({
  show,
  config,
  useCustomStyles,
  pendingProjectType,
  sizeMode,
  setSizeMode,
  modalLength,
  setModalLength,
  modalWidth,
  setModalWidth,
  modalSf,
  setModalSf,
  sizeError,
  onCancel,
  onSave
}) {
  if (!show) return null;

  // Get button colors from config
  const primaryButtonColor = config?.primary_button_color || "#f97316";
  const primaryButtonTextColor = config?.primary_button_text_color || "#ffffff";
  const primaryButtonHoverColor = config?.primary_button_hover_color || "#ea580c";

  const dimsButtonClass = useCustomStyles
    ? "flex-1 py-2 px-4 rounded-lg font-medium"
    : sizeMode === "dims"
      ? "flex-1 py-2 px-4 rounded-lg font-medium bg-orange-500 text-white"
      : "flex-1 py-2 px-4 rounded-lg font-medium bg-gray-100";

  const dimsButtonStyle = useCustomStyles
    ? sizeMode === "dims"
      ? { backgroundColor: primaryButtonColor, color: primaryButtonTextColor }
      : { backgroundColor: "#f3f4f6", color: "#6b7280" }
    : {};

  const sfButtonClass = useCustomStyles
    ? "flex-1 py-2 px-4 rounded-lg font-medium"
    : sizeMode === "sf"
      ? "flex-1 py-2 px-4 rounded-lg font-medium bg-orange-500 text-white"
      : "flex-1 py-2 px-4 rounded-lg font-medium bg-gray-100";

  const sfButtonStyle = useCustomStyles
    ? sizeMode === "sf"
      ? { backgroundColor: primaryButtonColor, color: primaryButtonTextColor }
      : { backgroundColor: "#f3f4f6", color: "#6b7280" }
    : {};

  const saveButtonClass = useCustomStyles
    ? "flex-1 font-medium py-2 rounded-lg"
    : "flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 rounded-lg";

  const saveButtonStyle = useCustomStyles
    ? { backgroundColor: primaryButtonColor, color: primaryButtonTextColor }
    : {};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold mb-4">Enter Size</h3>

        {pendingProjectType !== "commercial" && (
          <div className="flex gap-2 mb-4">
            <button 
              type="button" 
              onClick={() => setSizeMode("dims")} 
              className={dimsButtonClass}
              style={dimsButtonStyle}
            >
              Length × Width
            </button>
            <button 
              type="button" 
              onClick={() => setSizeMode("sf")} 
              className={sfButtonClass}
              style={sfButtonStyle}
            >
              Square Feet
            </button>
          </div>
        )}

        <div className="space-y-3 mb-4">
          {sizeMode === "dims" && pendingProjectType !== "commercial" ? (
            <div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Length (feet)</label>
                <input
                  type="number"
                  value={modalLength}
                  onChange={(e) => setModalLength(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Width (feet)</label>
                <input
                  type="number"
                  value={modalWidth}
                  onChange={(e) => setModalWidth(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="15"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">Square Feet</label>
              <input
                type="number"
                value={modalSf}
                onChange={(e) => setModalSf(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="300"
              />
            </div>
          )}
        </div>

        {sizeError && (
          <div className="bg-red-50 border-l-4 border-red-400 p-3 rounded mb-4 text-sm text-red-700">
            {sizeError}
          </div>
        )}

        <div className="flex gap-3">
          <button 
            type="button" 
            onClick={onCancel} 
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 rounded-lg"
          >
            Cancel
          </button>
          <button 
            type="button" 
            onClick={onSave} 
            className={saveButtonClass}
            style={saveButtonStyle}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}