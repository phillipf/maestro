type StartupErrorScreenProps = {
  message: string
}

export function StartupErrorScreen({ message }: StartupErrorScreenProps) {
  return (
    <main className="auth-shell">
      <section className="auth-card panel stack-sm">
        <p className="eyebrow">Startup Error</p>
        <h1>Configuration issue</h1>
        <p className="status-bad">{message}</p>
        <p className="hint">
          Check Cloudflare Pages environment variables and redeploy.
        </p>
      </section>
    </main>
  )
}
