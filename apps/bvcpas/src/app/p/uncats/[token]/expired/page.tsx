// Fallback cuando el token público está revocado (410).

export default function Page() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-xl font-semibold">This link is no longer active</h1>
      <p className="text-sm text-muted-foreground">
        Please contact your accountant for a new link.
      </p>
    </div>
  )
}
