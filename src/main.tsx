import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { StartupErrorScreen } from './app/StartupErrorScreen'
import './index.css'

const REQUIRED_ENV_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_ALLOWED_EMAIL',
] as const

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('App root element not found.')
}

const root = createRoot(rootElement)

function renderStartupError(message: string) {
  root.render(
    <StrictMode>
      <StartupErrorScreen message={message} />
    </StrictMode>,
  )
}

function missingEnvKeys(): string[] {
  return REQUIRED_ENV_KEYS.filter((key) => {
    const value = import.meta.env[key]
    return typeof value !== 'string' || value.trim() === ''
  })
}

async function bootstrapApp() {
  const missing = missingEnvKeys()

  if (missing.length > 0) {
    renderStartupError(`Missing required environment variable: ${missing[0]}`)
    return
  }

  try {
    const { App } = await import('./app/App')

    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to initialize app.'
    renderStartupError(message)
  }
}

void bootstrapApp()
