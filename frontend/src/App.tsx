import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { HomePage } from "./pages/HomePage"
import { ForecastPage } from "./pages/ForecastPage"
import { AlertDetailPage } from "./pages/AlertDetailPage"
import { ReportPage } from "./pages/ReportPage"
import { MapPage } from "./pages/MapPage"
import { KnowledgePage } from "./pages/KnowledgePage"
import { ProfileEditPage, ProfilePage } from "./pages/ProfilePage"
import { OnboardingPage } from "./pages/OnboardingPage"
import { IncidentPage } from "./pages/IncidentPage"
import { PWABadge } from "./components/PWABadge"
import { needsOnboarding } from "./lib/onboarding"

/** Set only in the staging build (STAGE_LABEL in .env): marks every page so testers never mistake it for the real app. */
const STAGE_LABEL = (import.meta.env.VITE_STAGE_LABEL as string | undefined)?.trim() || ""
if (STAGE_LABEL && typeof document !== "undefined") {
  document.title = `[${STAGE_LABEL}] ${document.title}`
  const robots = document.createElement("meta")
  robots.name = "robots"
  robots.content = "noindex, nofollow"
  document.head.appendChild(robots)
}

function StageBadge() {
  if (!STAGE_LABEL) return null
  return (
    <div role="status" aria-label={`Versi uji: ${STAGE_LABEL}`}
      className="fixed bottom-24 left-2 z-50 pointer-events-none rounded-full bg-fuchsia-700/90 px-3 py-1 text-xs font-extrabold tracking-wide text-white shadow">
      {STAGE_LABEL}
    </div>
  )
}

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
        <Route path="/kejadian" element={<IncidentPage />} />
        <Route path="/lapor" element={<ReportPage />} />
        <Route path="/report" element={<Navigate to="/lapor" replace />} />
        <Route path="/peta" element={<MapPage />} />
        <Route path="/pengetahuan" element={<KnowledgePage />} />
        <Route path="/profil" element={<ProfilePage />} />
        <Route path="/profil/ubah" element={<ProfileEditPage />} />
        <Route path="/alerts/:id" element={<AlertDetailPage />} />
        <Route path="/forecast" element={<ForecastPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <PWABadge />
      <StageBadge />
    </BrowserRouter>
  )
}
