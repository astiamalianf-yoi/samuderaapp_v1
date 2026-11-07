import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { HomePage } from "./pages/HomePage"
import { ForecastPage } from "./pages/ForecastPage"
import { AlertDetailPage } from "./pages/AlertDetailPage"
import { ReportPage } from "./pages/ReportPage"
import { MapPage } from "./pages/MapPage"
import { KnowledgePage } from "./pages/KnowledgePage"
import { ProfilePage } from "./pages/ProfilePage"
import { OnboardingPage } from "./pages/OnboardingPage"
import { PWABadge } from "./components/PWABadge"
import { needsOnboarding } from "./lib/onboarding"

/** First visit to the home page opens the introduction; links to warnings always open directly. */
function Home() {
  return needsOnboarding() ? <Navigate to="/mulai" replace /> : <HomePage />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/mulai" element={<OnboardingPage />} />
        <Route path="/lapor" element={<ReportPage />} />
        <Route path="/report" element={<Navigate to="/lapor" replace />} />
        <Route path="/peta" element={<MapPage />} />
        <Route path="/pengetahuan" element={<KnowledgePage />} />
        <Route path="/profil" element={<ProfilePage />} />
        <Route path="/alerts/:id" element={<AlertDetailPage />} />
        <Route path="/forecast" element={<ForecastPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <PWABadge />
    </BrowserRouter>
  )
}
