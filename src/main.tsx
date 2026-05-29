import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import './index.css'
import App from './App.tsx'

// Register the useGSAP hook as a GSAP plugin once for the whole app so the
// animation hooks under src/hooks/animations/ integrate cleanly.
gsap.registerPlugin(useGSAP)

document.documentElement.classList.add('dark')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
