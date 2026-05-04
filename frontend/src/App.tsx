import { Navigate, Route, Routes } from "react-router-dom";

import { CapturePage } from "./pages/CapturePage";
import { FreeResultPage } from "./pages/FreeResultPage";
import { PremiumResultPage } from "./pages/PremiumResultPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CapturePage />} />
      <Route path="/resultado/free" element={<FreeResultPage />} />
      <Route path="/resultado/premium" element={<PremiumResultPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
