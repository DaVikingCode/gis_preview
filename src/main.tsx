import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from '@/components/theme-provider'
import { useTourStore } from '@/store/tour-store'

// Register the useGSAP hook as a GSAP plugin once for the whole app so the
// animation hooks under src/hooks/animations/ integrate cleanly.
gsap.registerPlugin(useGSAP)

// TEMP debug exposure
if (import.meta.env.DEV)
  (window as unknown as { __tour: typeof useTourStore }).__tour = useTourStore

// L'app démarre en light. Le thème est piloté par la visite via le ThemeProvider
// (cf. TourThemeSync) ; le step « Thème & personnalisation » bascule en dark à
// l'aide de l'AnimatedThemeToggler (magicui).

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="light" storageKey="gis-ui-theme">
      <App />
    </ThemeProvider>
  </StrictMode>,
)
