import { STRING_NUMS, type Position } from '../domain/fretboard'

export interface FretMarker {
  position: Position
  /** classe de cor: target (nota certa), played (nota tocada), heat */
  kind: 'target' | 'played' | 'heat' | 'neutral'
  label?: string
  /** para kind = heat */
  fill?: string
  title?: string
}

const STRING_GAP = 16
const FRET_W = 46
const OPEN_W = 30
const PAD_Y = 14
const INLAYS = [3, 5, 7, 9, 12]

/**
 * Braço horizontal, corda 1 em cima (como numa tablatura). Casas
 * `fromFret`..`toFret`; a casa 0 aparece como coluna das cordas soltas.
 */
export function Fretboard({
  markers,
  toFret = 5,
  className = '',
  ariaLabel,
}: {
  markers: FretMarker[]
  toFret?: number
  className?: string
  ariaLabel?: string
}) {
  const nutX = OPEN_W
  const width = nutX + toFret * FRET_W + 8
  const height = PAD_Y * 2 + STRING_GAP * 5 + 4
  const yOf = (s: number) => PAD_Y + (s - 1) * STRING_GAP
  const xOf = (fret: number) => (fret === 0 ? OPEN_W / 2 : nutX + (fret - 0.5) * FRET_W)
  const bottom = yOf(6)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`fretboard ${className}`} role="img" aria-label={ariaLabel}>
      {Array.from({ length: toFret }, (_, i) => i + 1)
        .filter((f) => INLAYS.includes(f))
        .map((f) =>
          f === 12 ? (
            <g key={f} className="fb-inlay">
              <circle cx={xOf(f)} cy={yOf(2) + STRING_GAP / 2} r={3} />
              <circle cx={xOf(f)} cy={yOf(4) + STRING_GAP / 2} r={3} />
            </g>
          ) : (
            <circle key={f} className="fb-inlay" cx={xOf(f)} cy={(yOf(1) + yOf(6)) / 2} r={3.2} />
          ),
        )}
      {Array.from({ length: toFret }, (_, i) => i + 1).map((f) => (
        <line key={f} className="fb-fret" x1={nutX + f * FRET_W} x2={nutX + f * FRET_W} y1={yOf(1)} y2={bottom} />
      ))}
      <line className="fb-nut" x1={nutX} x2={nutX} y1={yOf(1) - 1} y2={bottom + 1} />
      {STRING_NUMS.map((s) => (
        <line
          key={s}
          className="fb-string"
          x1={4}
          x2={width - 4}
          y1={yOf(s)}
          y2={yOf(s)}
          strokeWidth={0.7 + (s - 1) * 0.28}
        />
      ))}
      {Array.from({ length: toFret }, (_, i) => i + 1)
        .filter((f) => f === 1 || INLAYS.includes(f))
        .map((f) => (
          <text key={f} className="fb-fretnum" x={xOf(f)} y={bottom + 16} textAnchor="middle">
            {f}
          </text>
        ))}
      {markers.map((m, i) => (
        <g key={i} className={`fb-marker fb-${m.kind}`} transform={`translate(${xOf(m.position.fret)} ${yOf(m.position.string)})`}>
          {m.title && <title>{m.title}</title>}
          <circle r={m.kind === 'heat' ? 6.5 : 7.5} style={m.fill ? { fill: m.fill } : undefined} />
          {m.label && (
            <text textAnchor="middle" dy="0.35em">
              {m.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}
