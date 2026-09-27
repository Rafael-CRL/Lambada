import '@fontsource-variable/lexend-deca'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource/bravura/400.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './index.css'

// carrega o glifo musical cedo para a pauta não aparecer sem clave
void document.fonts?.load('40px Bravura', '')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
