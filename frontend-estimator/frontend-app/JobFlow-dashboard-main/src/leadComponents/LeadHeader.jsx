// File: src/leadComponents/LeadsHeader.jsx

import SettingsMenu from "../SettingsMenu.jsx";
import { useCompany } from "../CompanyContext.jsx";

export default function LeadsHeader() {
  const { currentCompany } = useCompany();

  return (
    <div className="bg-[#225ce5] text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-5 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">CoatingPro360</h1>
          <p className="text-blue-100">{currentCompany?.name || ""}</p>
        </div>

        <SettingsMenu />
      </div>
    </div>
  );
}
