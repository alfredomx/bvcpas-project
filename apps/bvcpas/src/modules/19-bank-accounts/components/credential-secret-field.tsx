'use client'

import { useState } from 'react'
import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

export interface CredentialSecretFieldProps {
  label: string
  value: string | null
  // secret = ocultar por defecto y mostrar toggle de revelar.
  secret?: boolean
  // wrap = no truncar; el valor revelado fluye en varias líneas.
  wrap?: boolean
}

// Muestra un valor descifrado (username/password/QA) con botón de copiar
// y, si es secreto, un toggle de revelar. El valor vive SOLO en memoria
// del componente: no se persiste en localStorage ni se loguea.
export function CredentialSecretField({
  label,
  value,
  secret = false,
  wrap = false,
}: CredentialSecretFieldProps) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  const hasValue = value !== null && value !== ''

  const copy = async () => {
    if (!hasValue) return
    try {
      await navigator.clipboard.writeText(value as string)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  const display = !hasValue ? '—' : secret && !revealed ? '••••••••' : (value as string)

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-1">
        <code
          className={`min-w-0 flex-1 rounded bg-muted/50 px-2 py-1 font-mono text-sm ${wrap ? 'whitespace-pre-wrap break-words' : 'truncate'}`}
        >
          {display}
        </code>
        {secret && hasValue && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}
            onClick={() => setRevealed((r) => !r)}
          >
            {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Copy ${label}`}
          disabled={!hasValue}
          onClick={copy}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </Button>
      </div>
    </div>
  )
}
