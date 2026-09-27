import type { ReactNode } from 'react'
import type { Note } from '../domain/notes'
import type { Figure } from '../domain/rhythm'
import { staffStep } from '../domain/staff'
import { clefShape, CLEF_END, LABEL_Y, NOTEHEAD_W, noteShapes, restShapes, S, STAFF_HEIGHT, staffLines, yOfStep, type NoteDraw, type Shape } from './geometry'

export function ShapeView({ s }: { s: Shape }) {
  if (s.k === 'glyph')
    return (
      <text x={s.x} y={s.y} className={`smufl part-${s.part}`}>
        {s.ch}
      </text>
    )
  return <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} strokeWidth={s.w} className={`part-${s.part}`} />
}

export interface StaffNoteSpec {
  note: Note
  key: string
  draw?: NoteDraw
  /** desenha uma pausa desta figura no lugar da nota */
  rest?: Figure
  /** classe extra aplicada ao grupo (ex.: estado de acerto/erro, cor do heatmap) */
  className?: string
  style?: React.CSSProperties
  label?: string
  labelOpacity?: number
  title?: string
  /** torna a nota selecionável (clique, toque ou teclado) */
  onSelect?: () => void
  selected?: boolean
}

/**
 * Pauta estática com notas espaçadas igualmente. Para listas e telas que não
 * animam (resumo, progresso, Pauta → violão).
 */
export function StaffSvg({
  notes,
  spacing = 44,
  padRight = 24,
  minWidth = 0,
  className = '',
  style,
  children,
  ariaLabel,
}: {
  notes: StaffNoteSpec[]
  spacing?: number
  padRight?: number
  minWidth?: number
  className?: string
  style?: React.CSSProperties
  children?: ReactNode
  ariaLabel?: string
}) {
  const first = CLEF_END + 18
  const width = Math.max(minWidth, first + Math.max(0, notes.length - 1) * spacing + NOTEHEAD_W + padRight)
  // notas acima do Mi6 (muitas suplementares) ganham espaço extra no topo
  const highest = Math.min(...notes.filter((n) => !n.rest).map((n) => yOfStep(staffStep(n.note))), Infinity)
  const topPad = Math.max(0, 1.5 * S - highest)
  const interactive = notes.some((n) => n.onSelect)
  return (
    <svg
      viewBox={`0 ${-topPad} ${width} ${STAFF_HEIGHT + topPad}`}
      className={`staff ${className}`}
      style={style}
      role={interactive ? 'group' : 'img'}
      aria-label={ariaLabel}
      preserveAspectRatio="xMinYMid meet"
    >
      <g className="staff-bg">
        {staffLines(0, width).map((s, i) => (
          <ShapeView key={i} s={s} />
        ))}
        <ShapeView s={clefShape()} />
      </g>
      {notes.map((n, i) => (
        <g
          key={n.key}
          className={`note ${n.className ?? ''} ${n.onSelect ? 'is-selectable' : ''} ${n.selected ? 'is-selected' : ''}`}
          style={n.style}
          transform={`translate(${first + i * spacing} 0)`}
          {...(n.onSelect && {
            role: 'button',
            tabIndex: 0,
            'aria-label': n.title,
            'aria-pressed': !!n.selected,
            onClick: n.onSelect,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                n.onSelect!()
              }
            },
          })}
        >
          {n.title && <title>{n.title}</title>}
          {/* área de toque maior que a cabeça da nota */}
          {n.onSelect && <rect x={-S} y={-S} width={NOTEHEAD_W + 2 * S} height={STAFF_HEIGHT} className="note-hit" />}
          {(n.rest ? restShapes(n.rest) : noteShapes(n.note, n.draw)).map((s, j) => (
            <ShapeView key={j} s={s} />
          ))}
          {n.label && (
            <text
              x={NOTEHEAD_W / 2}
              y={LABEL_Y}
              className="note-label"
              textAnchor="middle"
              style={{ opacity: n.labelOpacity ?? 1 }}
            >
              {n.label}
            </text>
          )}
        </g>
      ))}
      {children}
    </svg>
  )
}
