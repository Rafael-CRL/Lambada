import type { ReactNode } from 'react'
import type { Note } from '../domain/notes'
import { clefShape, CLEF_END, LABEL_Y, NOTEHEAD_W, noteShapes, STAFF_HEIGHT, staffLines, type Shape } from './geometry'

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
  /** classe extra aplicada ao grupo (ex.: estado de acerto/erro, cor do heatmap) */
  className?: string
  style?: React.CSSProperties
  label?: string
  labelOpacity?: number
  title?: string
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
  return (
    <svg
      viewBox={`0 0 ${width} ${STAFF_HEIGHT}`}
      className={`staff ${className}`}
      style={style}
      role="img"
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
          className={`note ${n.className ?? ''}`}
          style={n.style}
          transform={`translate(${first + i * spacing} 0)`}
        >
          {n.title && <title>{n.title}</title>}
          {noteShapes(n.note).map((s, j) => (
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
