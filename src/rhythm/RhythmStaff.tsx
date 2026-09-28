import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { parseNote } from '../domain/notes'
import { FIGURE_BEATS, type RhythmEvent } from '../domain/rhythm'
import {
  barlineShapes,
  clefShape,
  NOTEHEAD_W,
  naturalStemEnd,
  noteShapes,
  percussionClefShape,
  restShapes,
  S,
  singleLine,
  staffLines,
  timeSigShapes,
  TIMESIG_W,
  yOfStep,
  type NoteDraw,
  type Shape,
} from '../staff/geometry'
import { ShapeView } from '../staff/StaffSvg'
import { cx } from '../ui/controls'
import type { Mark } from './controller'

/** Largura de um pulso e respiro depois de cada barra. */
const BEAT_W = 5.6 * S
const INNER = 1.4 * S
const END_PAD = 1.2 * S

/** Pauta de ritmo: uma linha (Si4, a do meio) ou cinco, com todas as notas no Sol. */
export type RhythmStaffKind = 'line' | 'staff'

const PITCH = { line: parseNote('B4'), staff: parseNote('G4') }

export interface RhythmLayout {
  width: number
  x0: number
  /** x do começo de cada compasso */
  bars: number[]
  barW: number
  /** x do centro da cabeça no pulso `beat` do trecho */
  beatX: (beat: number) => number
  /** viewBox vertical */
  top: number
  height: number
}

export function rhythmLayout(nBars: number, meter: number, kind: RhythmStaffKind): RhythmLayout {
  const x0 = kind === 'line' ? 28 + TIMESIG_W + 10 : 44 + TIMESIG_W + 10
  const barW = INNER + meter * BEAT_W
  const bars = Array.from({ length: nBars }, (_, b) => x0 + b * barW)
  const width = x0 + nBars * barW + END_PAD
  const beatX = (beat: number) => {
    const b = Math.min(nBars - 1, Math.max(0, Math.floor(beat / meter)))
    const within = Math.min(meter, beat - b * meter)
    return bars[b] + INNER + within * BEAT_W + NOTEHEAD_W / 2
  }
  return kind === 'line' ? { width, x0, bars, barW, beatX, top: 14, height: 84 } : { width, x0, bars, barW, beatX, top: 18, height: 96 }
}

/** Desenho de um evento com a cabeça começando em x = 0. */
export function eventShapes(e: Omit<RhythmEvent, 'beatInBar'>, kind: RhythmStaffKind, beamTo?: number): Shape[] {
  if (e.rest) return restShapes(e.figure)
  const n = PITCH[kind]
  const draw: NoteDraw = { figure: e.figure, up: true }
  if (e.beam) {
    // par de colcheias: hastes para cima, barra reta
    draw.stem = { up: true, toY: naturalStemEnd(n, true) }
    if (e.beam === 'start') draw.beamTo = beamTo
  }
  return noteShapes(n, draw)
}

export interface RhythmStaffHandle {
  /** cursor no pulso `pos` do trecho (null esconde) */
  setCursor: (pos: number | null) => void
}

/**
 * Trecho de ritmo desenhado de uma vez (não rola). O cursor anda por fora do
 * React (setCursor, a cada quadro). Cada evento pode ter marca de acerto ou
 * erro; batidas a mais aparecem como tracinhos vermelhos sob a linha.
 */
export const RhythmStaff = forwardRef<
  RhythmStaffHandle,
  {
    bars: RhythmEvent[][]
    meter: number
    kind?: RhythmStaffKind
    marks?: Mark[]
    extras?: number[]
    /** índice do evento escondido (complete o compasso) e como mostrá-lo */
    gap?: { index: number; state: 'ask' | 'ok' | 'err' }
    /** pulsos ainda vazios no fim de cada compasso (escrita) */
    empty?: number[]
    /** compassos inteiros marcados (escrita conferida) */
    barMarks?: (boolean | null)[]
    className?: string
    ariaLabel?: string
    /** quantos compassos o desenho reserva (para trechos do mesmo tamanho não mudarem de escala) */
    minBars?: number
  }
>(function RhythmStaff({ bars, meter, kind = 'line', marks = [], extras = [], gap, empty, barMarks, className, ariaLabel, minBars = 1 }, ref) {
  const L = useMemo(() => rhythmLayout(Math.max(bars.length, minBars), meter, kind), [bars.length, minBars, meter, kind])
  const cursor = useRef<SVGGElement>(null)
  useImperativeHandle(ref, () => ({
    setCursor(pos) {
      const g = cursor.current
      if (!g) return
      if (pos === null) {
        g.style.opacity = '0'
        return
      }
      g.style.opacity = '1'
      g.setAttribute('transform', `translate(${L.beatX(pos).toFixed(2)} 0)`)
    },
  }))

  const single = kind === 'line'
  const lineY = yOfStep(4)
  const staffShapes: Shape[] = single ? [singleLine(0, L.width), percussionClefShape()] : [...staffLines(0, L.width), clefShape()]
  const tsX = single ? 28 : 44
  let k = 0
  return (
    <svg
      viewBox={`0 ${L.top} ${L.width} ${L.height}`}
      className={cx('staff rhythm', className)}
      role="img"
      aria-label={ariaLabel ?? 'Ritmo'}
      preserveAspectRatio="xMidYMid meet"
    >
      <g className="staff-bg">
        {staffShapes.map((s, i) => (
          <ShapeView key={i} s={s} />
        ))}
        {timeSigShapes(meter, tsX, single).map((s, i) => (
          <ShapeView key={`t${i}`} s={s} />
        ))}
        {L.bars.map((x, b) => (
          <g key={`b${b}`} transform={`translate(${x + L.barW} 0)`}>
            {barlineShapes(single, b === L.bars.length - 1).map((s, i) => (
              <ShapeView key={i} s={s} />
            ))}
          </g>
        ))}
      </g>
      {bars.map((bar, b) =>
        bar.map((e, j) => {
          const index = k++
          const x = L.bars[b] + INNER + e.beatInBar * BEAT_W
          if (gap?.index === index && gap.state === 'ask') {
            const w = FIGURE_BEATS[e.figure] * BEAT_W - 0.8 * S
            return (
              <g key={`${b}:${j}`} className="rhythm-gap" transform={`translate(${x - 0.3 * S} 0)`}>
                <rect x={0} y={lineY - 2.6 * S} width={w} height={3.6 * S} rx={0.8 * S} />
                <text x={w / 2} y={lineY - 0.8 * S} textAnchor="middle" dominantBaseline="central">
                  ?
                </text>
              </g>
            )
          }
          const mark = gap?.index === index ? gap.state : (barMarks?.[b] === true ? 'ok' : barMarks?.[b] === false ? 'err' : marks[index])
          const next = bar[j + 1]
          const beamTo = e.beam === 'start' && next ? (next.beatInBar - e.beatInBar) * BEAT_W : undefined
          return (
            <g key={`${b}:${j}`} className={cx('note', mark === 'ok' && 'is-ok', mark === 'err' && 'is-err', e.rest && 'is-rest')} transform={`translate(${x} 0)`}>
              {eventShapes(e, kind, beamTo).map((s, i) => (
                <ShapeView key={i} s={s} />
              ))}
            </g>
          )
        }),
      )}
      {empty?.map((beats, b) =>
        beats > 0 ? (
          <rect
            key={`e${b}`}
            className="rhythm-empty"
            x={L.bars[b] + INNER + (meter - beats) * BEAT_W - 0.3 * S}
            y={lineY - 2.6 * S}
            width={beats * BEAT_W - 0.8 * S}
            height={3.6 * S}
            rx={0.8 * S}
          />
        ) : null,
      )}
      {extras.map((beat, i) => (
        <line key={`x${i}`} className="rhythm-extra" x1={L.beatX(beat)} x2={L.beatX(beat)} y1={lineY + 1.6 * S} y2={lineY + 2.8 * S} />
      ))}
      <g ref={cursor} style={{ opacity: 0 }} className="rhythm-cursor">
        <line x1={0} x2={0} y1={single ? lineY - 4.2 * S : yOfStep(9)} y2={single ? lineY + 2 * S : yOfStep(-1)} />
      </g>
    </svg>
  )
})

/** Contagem 1 2 3 4 sob a pauta; o pulso atual acende (o 1 mais forte). */
export function BeatCount({ meter, count, countIn }: { meter: number; count: number | null; countIn: boolean }) {
  return (
    <div className="flex justify-center gap-5 font-mono text-lg tabular" aria-hidden="true">
      {Array.from({ length: meter }, (_, i) => (
        <span
          key={i}
          className={cx(
            'grid size-8 place-items-center rounded-full transition-colors duration-75',
            count === i ? (countIn ? 'bg-surface-2 text-text' : 'bg-accent text-accent-ink') : 'text-sub',
            i === 0 && 'font-semibold',
          )}
        >
          {i + 1}
        </span>
      ))}
    </div>
  )
}

/** Figura solta (paleta, botões, cartões): a cabeça na linha, haste para cima. */
export function FigureGlyph({ events, className }: { events: Omit<RhythmEvent, 'beatInBar'>[]; className?: string }) {
  const beats = events.reduce((s, e) => s + FIGURE_BEATS[e.figure], 0)
  const span = events.length > 1 ? (events.length - 1) * 2.4 * S : 0
  const w = NOTEHEAD_W + span + 2.4 * S
  let x = 1.2 * S
  return (
    <svg viewBox={`0 ${yOfStep(4) - 4.6 * S} ${w} ${6.4 * S}`} className={cx('staff rhythm w-auto', className ?? 'h-8')} aria-hidden="true" data-beats={beats}>
      {events.map((e, i) => {
        const gx = x
        x += 2.4 * S
        const beamTo = e.beam === 'start' ? 2.4 * S : undefined
        return (
          <g key={i} className={cx('note', e.rest && 'is-rest')} transform={`translate(${gx} 0)`}>
            {eventShapes(e, 'line', beamTo).map((s, j) => (
              <ShapeView key={j} s={s} />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

