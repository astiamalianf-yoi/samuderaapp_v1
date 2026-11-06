import { BrowserRouter, Routes, Route } from "react-router-dom"
import { HomePage } from "./pages/HomePage"
import { ForecastPage } from "./pages/ForecastPage"
import { AlertDetailPage } from "./pages/AlertDetailPage"

import { PWABadge } from "./components/PWABadge"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/alerts/:id" element={<AlertDetailPage />} />
        <Route path="/forecast" element={<ForecastPage />} />
      </Routes>
      <PWABadge />
    </BrowserRouter>
  )
}