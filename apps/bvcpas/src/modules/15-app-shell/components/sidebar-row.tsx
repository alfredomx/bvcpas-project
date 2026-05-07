'use client'

// Fila visual densa de un cliente. Replica HTML 1:1 con
// reference/components/CSOrbitView.jsx (StreamRow):
//
//   <div.stream-row>
//     <div.sr-heat />
//     <div.sr-body>
//       <div.sr-line1>
//         <span.sr-vip>★</span>
//         <span.sr-name>...</span>
//         <span style="flex:1" />
//         <span.sr-amt.mono>$62.6k</span>
//       </div>
//       <div.sr-line2>
//         <span.sr-status>◴ awaiting reply</span>
//         <span.sr-silent>· 3mo silent</span>
//         <span.sr-unc>· 26 uncats</span>
//         <span style="flex:1" />
//         <span.sr-contact>Hector Zavala</span>
//       </div>
//       <div.sr-spark>
//         [13 segmentos: 1 carry + 12 meses]
//       </div>
//     </div>
//   </div>
//
// Estilos reales del CSS prototipo (reference/cs-styles.css 670–720):
//   - .stream-row: display:flex (row), border-bottom 1px var(--border-soft)
//   - .sr-heat: width 3px, flex-shrink 0
//   - .sr-body: flex 1, padding 9px 12px 10px, min-width 0
//   - .sr-line1: display:flex, align-items:baseline, gap:6px, mb:4px
//   - .sr-line2: display:flex, align-items:baseline, gap:4px, font:10px,
//                color:text-3, mb:6px
//   - .sr-vip: amber, 10px
//   - .sr-name: 12px, color text-0, font-weight 500
//   - .sr-amt: 10.5px, color text-1, flex-shrink 0
//   - .sr-status: inline-flex, gap:4px, font-weight:500
//   - .sr-glyph: 10px
//   - .sr-silent: font-weight 500
//   - .sr-contact: text-3, max-width 110px, ellipsis
//   - .sr-spark: display:flex, gap:1px, align-items:center
//   - segmento: flex 1 1 0, height:4px; carry: flex 0 0 8px, border-right,
//     margin-right:3
//
// v0.3.0: solo `legalName` viene del backend. El resto son placeholders
// visuales hardcodeados.

import { cn } from '@/lib/utils'

export interface SidebarRowProps {
  clientId: string
  legalName: string
  /** Cliente actualmente seleccionado en la URL. */
  active?: boolean
  onSelect: (clientId: string) => void
}

// Sparkline placeholder. Cada segmento tiene color hardcodeado;
// el original calcula intensidad por valor. Aquí solo decoración.
const SPARKLINE_PLACEHOLDER: { color: string; carry?: boolean }[] = [
  { color: 'bg-text-disabled', carry: true },
  { color: 'bg-status-success/70' },
  { color: 'bg-brand-accent/70' },
  { color: 'bg-brand-accent-soft/70' },
  { color: 'bg-text-disabled' },
  { color: 'bg-text-disabled' },
  { color: 'bg-text-disabled' },
  { color: 'bg-text-disabled' },
  { color: 'bg-text-disabled' },
  { color: 'bg-text-disabled' },
  { color: 'bg-text-disabled' },
  { color: 'bg-text-disabled' },
  { color: 'bg-text-disabled' },
]

export function SidebarRow({ clientId, legalName, active = false, onSelect }: SidebarRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(clientId)}
      aria-current={active ? 'page' : undefined}
      // .stream-row: flex (row), border-bottom + active=lavender + border-left 3px naranja
      className={cn(
        'flex h-full w-full items-stretch border-b border-border-soft border-l-[3px] font-sans text-left transition-colors',
        active
          ? 'border-l-brand-accent bg-surface-lavender'
          : 'border-l-transparent hover:bg-surface-soft',
      )}
    >
      {/* .sr-heat: 3px, decorativo. Color por urgencia (placeholder rojo). */}
      <div className="w-0.75 shrink-0 bg-status-danger/50" aria-hidden />

      {/* .sr-body: padding 9 12 10, flex-col, min-width 0 */}
      <div className="flex min-w-0 flex-1 flex-col px-3 pb-2.5 pt-2.25">
        {/* .sr-line1: items-baseline, gap 6px, mb 4px */}
        <div className="mb-1 flex items-baseline gap-1.5">
          <span className="text-[10px] leading-none text-brand-accent-strong" aria-hidden>
            ★
          </span>
          <span
            className={cn(
              'min-w-0 truncate text-[12px] tracking-tight',
              active ? 'font-semibold text-brand-navy' : 'font-medium text-brand-navy',
            )}
          >
            {legalName}
          </span>
          {/* spacer flex:1 — espejo del <span style={{ flex: 1 }} /> del prototipo */}
          <span className="flex-1" />
          <span className="shrink-0 font-mono text-[10.5px] text-text-secondary">$62.6k</span>
        </div>

        {/* .sr-line2: items-baseline, gap 4px, font 10px, color text-3, mb 6px.
            line-height del body (1.45) heredado, no leading-tight. */}
        <div className="mb-1.5 flex items-baseline gap-1 text-[10px] text-text-tertiary">
          {/* .sr-status: inline-flex gap 4px font-weight 500. Color por status. */}
          <span className="inline-flex items-center gap-1 font-medium text-status-danger">
            {/* .sr-glyph */}
            <span aria-hidden className="text-[10px]">
              ◴
            </span>
            awaiting reply
          </span>
          {/* .sr-silent: prefijo "· " inline, font-weight 500 */}
          <span className="font-medium text-status-danger">· 3mo silent</span>
          {/* .sr-unc: prefijo "· " inline */}
          <span>· 26 uncats</span>
          {/* spacer flex:1 — espejo del <span style={{ flex: 1 }} /> */}
          <span className="flex-1" />
          {/* .sr-contact: max-width 110px, truncate */}
          <span className="max-w-27.5 shrink-0 truncate text-text-tertiary">Hector Zavala</span>
        </div>

        {/* .sr-spark: flex gap-1px items-center, height 4px */}
        <div className="flex items-center gap-px">
          {SPARKLINE_PLACEHOLDER.map((seg, i) => (
            <div
              key={i}
              className={cn(
                'h-1 rounded-[1px]',
                seg.color,
                seg.carry ? 'mr-0.75 w-2 border-r border-border-strong' : 'flex-1',
              )}
              aria-hidden
            />
          ))}
        </div>
      </div>
    </button>
  )
}
