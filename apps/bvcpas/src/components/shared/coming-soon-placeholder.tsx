export interface ComingSoonPlaceholderProps {
  tab: string
}

export function ComingSoonPlaceholder({ tab }: ComingSoonPlaceholderProps) {
  return (
    <section className="flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Coming soon</p>
      <h2 className="text-xl font-semibold">{tab}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        This tab will be available in a future release.
      </p>
    </section>
  )
}
