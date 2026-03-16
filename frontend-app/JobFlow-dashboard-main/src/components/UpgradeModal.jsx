export default function UpgradeModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Pro Feature</h2>
        <p className="text-gray-600 text-sm mb-6">
          Upgrade to CoatingPro360 Pro to gain access to these features.
        </p>
        <button
          onClick={onClose}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
        >
          OK
        </button>
      </div>
    </div>
  );
}
