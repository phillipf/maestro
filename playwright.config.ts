import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    env: {
      VITE_SUPABASE_URL: 'https://mock.supabase.local',
      VITE_SUPABASE_ANON_KEY: 'mock-anon-key',
      VITE_ALLOWED_EMAIL: 'test@example.com',
    },
  },
})
