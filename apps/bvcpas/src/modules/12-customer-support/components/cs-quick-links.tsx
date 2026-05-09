// 6 botones placeholder. Todos toast "Coming soon" hasta que se
// implementen las acciones reales en versiones futuras.

import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

const LINKS = [
  { key: 'sheet', label: 'Sheet' },
  { key: 'email', label: '@ Email thread' },
  { key: 'qbo', label: 'qb QBO file' },
  { key: 'call', label: 'Call log' },
  { key: 'note', label: 'Add note' },
  { key: 'snooze', label: 'Snooze' },
] as const

export function CsQuickLinks() {
  const handleClick = (label: string) => {
    toast.message(`${label} coming soon.`)
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Quick links</p>
      <div className="flex flex-wrap gap-2">
        {LINKS.map((link) => (
          <Button
            key={link.key}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleClick(link.label)}
          >
            {link.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
