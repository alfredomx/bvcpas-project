'use client'

export default function DashboardEmptyStatePage() {
  return (
    <section className="flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">No client selected</p>
      <h2 className="text-xl font-semibold">Select a client</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Pick a client from the sidebar to see their tabs and details.
      </p>
    </section>
  )
}
