import { Navigate, Route, Routes } from "react-router-dom";

import { FaceCalibrationProvider } from "./contexts/FaceCalibrationContext";
import { CapturePage } from "./pages/CapturePage";
import { CompareResultPage } from "./pages/CompareResultPage";
import { FreeResultPage } from "./pages/FreeResultPage";
import { PremiumResultPage } from "./pages/PremiumResultPage";
import { AdminTemplatesPage } from "./pages/AdminTemplatesPage";
import AdminRecommendationsPage from "./pages/AdminRecommendationsPage";
import AdminMetricIdealPage from "./pages/AdminMetricIdealPage";
import AdminGlobalWeightsPage from "./pages/AdminGlobalWeightsPage";
import AdminBlacklistPage from "./pages/AdminBlacklistPage";
import AdminThresholdPage from "./pages/AdminThresholdPage";
import AdminExerciseStudioPage from "./pages/AdminExerciseStudioPage";

export default function App() {
  return (
    <FaceCalibrationProvider>
      <Routes>
        <Route path="/" element={<CapturePage />} />
        <Route path="/resultado/free" element={<FreeResultPage />} />
        <Route path="/resultado/premium" element={<PremiumResultPage />} />
        <Route path="/resultado/compare" element={<CompareResultPage />} />
        <Route path="/admin/templates" element={<AdminTemplatesPage />} />
        <Route path="/admin/recommendations" element={<AdminRecommendationsPage />} />
        <Route path="/admin/metric-ideals" element={<AdminMetricIdealPage />} />
        <Route path="/admin/global-weights" element={<AdminGlobalWeightsPage />} />
        <Route path="/admin/blacklist" element={<AdminBlacklistPage />} />
        <Route path="/admin/threshold" element={<AdminThresholdPage />} />
        <Route path="/admin/exercise-studio" element={<AdminExerciseStudioPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </FaceCalibrationProvider>
  );
}
