import type { ReactNode } from 'react'
import { audioContext, ensureAudioRunning } from '../audio/clock'
import { Metronome } from '../audio/metronome'
import { playNote } from '../audio/synth'
import { ToneScheduler } from '../audio/tones'
import { RHYTHM } from '../config'
import type { Position } from '../domain/fretboard'
import { midiOf, namePt, parseNote, soundingFromWritten } from '../domain/notes'
import { barFromCells, cellEvents, FIGURE_BEATS, type CellId } from '../domain/rhythm'
import { onsets, type RhythmPattern } from '../rhythm/patterns'
import { FigureGlyph, RhythmStaff, rhythmLayout } from '../rhythm/RhythmStaff'
import { Fretboard, type FretMarker } from '../staff/Fretboard'
import { barlineShapes, CLEF_END, S, TIMESIG_W, timeSigShapes, yOfStep } from '../staff/geometry'
import { ShapeView, StaffSvg } from '../staff/StaffSvg'
import { cx } from '../ui/controls'
import { lessonNote } from './lessons'

/**
 * Desenhos dos cartões de conceito: pequenos, estáticos ou com uma animação
 * curta (linhas acendendo, pulso piscando). O som é opcional (botão ouvir).
 */

// ---------------------------------------------------------------- pauta

export interface ArtNote {
  id: string
  label?: string
  /** apagada (nota "pulada") */
  faint?: boolean
  accent?: boolean
}

/**
 * Pauta com notas (semibreves) e realces: linhas ou espaços acendendo em
 * sequência, números ao lado, a 2ª linha da clave.
 */
export function StaffArt({
  notes = [],
  glow,
  numbers,
  spacing = 40,
  minWidth = 260,
  compact = false,
  bars = [],
}: {
  notes?: ArtNote[]
  /** passos (pauta) que acendem, em ordem */
  glow?: number[]
  /** números ao lado; com os dois, os dos espaços numa coluna à esquerda */
  numbers?: 'lines' | 'spaces' | 'both'
  spacing?: number
  minWidth?: number
  /** menor, para dividir o cartão com o braço */
  compact?: boolean
  /** barra de compasso antes destas notas (índices) */
  bars?: number[]
}) {
  const width = Math.max(minWidth, CLEF_END + 18 + Math.max(0, notes.length - 1) * spacing + 40)
  return (
    <StaffSvg
      // a largura segue a proporção do desenho (centrado no cartão)
      className={compact ? 'h-40 w-auto max-w-full sm:h-56' : 'h-56 w-auto max-w-full sm:h-80'}
      minWidth={width}
      spacing={spacing}
      ariaLabel="Pauta"
      notes={notes.map((n, i) => {
        const { note, natural } = lessonNote(n.id)
        return {
          key: `${n.id}-${i}`,
          note,
          draw: { figure: 'whole' as const, natural },
          label: n.label,
          className: cx(n.faint && 'is-muted', n.accent && 'is-selected'),
        }
      })}
    >
      {bars.map((i) => (
        <g key={`b${i}`} transform={`translate(${CLEF_END + 18 + (i - 0.5) * spacing} 0)`}>
          {barlineShapes().map((sh, k) => (
            <ShapeView key={k} s={sh} />
          ))}
        </g>
      ))}
      {glow?.map((step, i) => (
        <line
          key={`g${step}`}
          className={cx('art-glow', step % 2 !== 0 && 'is-space')}
          style={{ animationDelay: `${i * 0.35}s` }}
          x1={0}
          x2={width}
          y1={yOfStep(step)}
          y2={yOfStep(step)}
          strokeWidth={step % 2 === 0 ? 0.35 * S : 0.9 * S}
        />
      ))}
      {numbers &&
        [0, 1, 2, 3, 4, 5, 6, 7, 8]
          .filter((step) => numbers === 'both' || (step % 2 === 0) === (numbers === 'lines'))
          .map((step, i) => {
            const line = step % 2 === 0
            // acende junto com a linha (ou o espaço) dele, quando há realce
            const order = glow?.includes(step) ? glow.indexOf(step) : i
            const x = width - (numbers === 'both' && !line ? 36 : 14)
            // o fundo corta a linha atrás do número (senão ela risca o texto)
            return (
              <g key={`n${step}`} className="art-number" style={{ animationDelay: `${order * 0.35}s` }}>
                <rect x={x - 7} y={yOfStep(step) - 4} width={14} height={8} rx={2} />
                <text x={x} y={yOfStep(step)} textAnchor="middle" dominantBaseline="central">
                  {line ? `${step / 2 + 1}ª` : `${(step + 1) / 2}º`}
                </text>
              </g>
            )
          })}
    </StaffSvg>
  )
}

/** "E4 G4 B4" → notas com o nome embaixo. */
export function artNotes(list: string, labels = true): ArtNote[] {
  return list.split(' ').map((id) => ({ id, label: labels ? namePt(lessonNote(id).note) : undefined }))
}

// ---------------------------------------------------------------- ritmo

/** Um compasso (ou dois) desenhado com a contagem embaixo de cada pulso. */
export function RhythmArt({
  cells,
  meter = 4,
  counts,
  kind = 'line',
}: {
  cells: CellId[][]
  meter?: number
  /** texto sob cada meio pulso ("1", "e", ...); padrão: 1 2 3 4 */
  counts?: 'beats' | 'halves' | 'none'
  kind?: 'line' | 'staff'
}) {
  const bars = cells.map(barFromCells)
  const L = rhythmLayout(bars.length, meter, kind)
  const labels: { beat: number; text: string; strong: boolean }[] = []
  if (counts !== 'none')
    for (let b = 0; b < bars.length * meter; b += counts === 'halves' ? 0.5 : 1)
      labels.push({ beat: b, text: b % 1 ? 'e' : String((b % meter) + 1), strong: b % meter === 0 })
  return (
    <div className="w-full max-w-2xl">
      <RhythmStaff bars={bars} meter={meter} kind={kind} className="w-full" />
      <svg viewBox={`0 0 ${L.width} ${2.4 * S}`} className="w-full" aria-hidden="true">
        {labels.map((l) => (
          <text key={l.beat} x={L.beatX(l.beat)} y={1.6 * S} textAnchor="middle" className={cx('art-count', l.strong && 'is-strong')}>
            {l.text}
          </text>
        ))}
      </svg>
    </div>
  )
}

/** Pulsos piscando no andamento das lições (o relógio da música). */
export function PulseArt({ label, beats = 4 }: { label?: string; beats?: number }) {
  const period = (beats * 60) / RHYTHM.bpm
  return (
    <div className="flex items-center justify-center gap-7">
      {label && <span className="w-16 text-right text-base text-sub">{label}</span>}
      {Array.from({ length: beats }, (_, i) => (
        <span
          key={i}
          className={cx('art-pulse size-7 rounded-full bg-surface-2', i === 0 && 'size-9')}
          style={{ animationDuration: `${period}s`, animationDelay: `${(i * 60) / RHYTHM.bpm}s` }}
        />
      ))}
    </div>
  )
}

/** Figura grande com os pulsos que ela dura. */
export function FigureArt({ cell, rest = false }: { cell: CellId; rest?: boolean }) {
  const ev = cellEvents(cell)
  const beats = ev.reduce((s, e) => s + FIGURE_BEATS[e.figure], 0)
  return (
    <div className="flex flex-col items-center gap-3">
      <FigureGlyph events={ev} className={cx('h-32 sm:h-40', rest && 'opacity-90')} />
      <div className="flex gap-2">
        {Array.from({ length: Math.ceil(beats) }, (_, i) => (
          <span key={i} className="size-4 rounded-full bg-accent" />
        ))}
      </div>
    </div>
  )
}

/** Fórmulas de compasso lado a lado; destaca o número de cima ou o de baixo. */
export function MeterArt({ meters = [4, 3, 2], mark }: { meters?: number[]; mark: 'top' | 'bottom' }) {
  const w = meters.length * (TIMESIG_W + 3 * S)
  return (
    <svg viewBox={`0 ${yOfStep(8) - S} ${w} ${yOfStep(0) - yOfStep(8) + 2 * S}`} className="staff h-40 w-auto sm:h-52" aria-hidden="true">
      {meters.map((m, i) => (
        <g key={m} transform={`translate(${i * (TIMESIG_W + 3 * S) + 1.5 * S} 0)`}>
          {[0, 2, 4, 6, 8].map((st) => (
            <line key={st} x1={-S} x2={TIMESIG_W + S} y1={yOfStep(st)} y2={yOfStep(st)} className="part-staff" strokeWidth={0.13 * S} />
          ))}
          {timeSigShapes(m, 0).map((s, k) => (
            <g key={k} className={cx((k === 0) === (mark === 'top') && 'art-accent')}>
              <ShapeView s={s} />
            </g>
          ))}
        </g>
      ))}
    </svg>
  )
}

/** Figura e a pausa de mesmo valor, lado a lado. */
export function RestPairsArt({ cells }: { cells: [CellId, CellId, string][] }) {
  return (
    <div className="grid w-full max-w-xl grid-cols-3 gap-6 text-center">
      {cells.map(([note, rest, name]) => (
        <div key={note} className="flex flex-col items-center gap-1">
          <div className="flex items-end gap-2">
            <FigureGlyph events={cellEvents(note)} className="h-20 sm:h-24" />
            <FigureGlyph events={cellEvents(rest)} className="h-20 sm:h-24" />
          </div>
          <span className="text-sm text-sub">{name}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- violão

/** Braço com as casas marcadas e o nome de cada uma. */
export function FretArt({ marks, toFret = 4 }: { marks: { position: Position; label: string }[]; toFret?: number }) {
  const markers: FretMarker[] = marks.map((m) => ({ position: m.position, kind: 'pick', label: m.label }))
  return <Fretboard className="w-full max-w-xl" toFret={toFret} markers={markers} ariaLabel="Braço do violão" />
}

// ---------------------------------------------------------------- som

/** Toca compassos (tom + metrônomo) no andamento das lições. */
export async function playBars(cells: CellId[][], meter = 4, bpm: number = RHYTHM.bpm) {
  if (!(await ensureAudioRunning())) return
  const p: RhythmPattern = { meter: meter as 2 | 3 | 4, bars: cells.map(barFromCells) }
  const spb = 60 / bpm
  const base = audioContext().currentTime + 0.15
  const total = cells.length * meter
  const metro = new Metronome(bpm, meter)
  const tones = new ToneScheduler()
  metro.start(base, 0, total - 1)
  for (const e of onsets(p)) tones.schedule(base + e.beat * spb, FIGURE_BEATS[e.figure] * spb, RHYTHM.toneFreq)
  window.setTimeout(() => {
    metro.dispose()
    tones.dispose()
  }, (total * spb + 1) * 1000)
}

/** Só o pulso (cliques). */
export async function playPulse(beats = 4, meter = 4) {
  if (!(await ensureAudioRunning())) return
  const metro = new Metronome(RHYTHM.bpm, meter)
  metro.start(audioContext().currentTime + 0.15, 0, beats - 1)
  window.setTimeout(() => metro.dispose(), ((beats * 60) / RHYTHM.bpm + 1) * 1000)
}

/** Notas escritas em sequência (soando como no violão, uma oitava abaixo). */
export async function playNotes(list: string, gap = 0.45) {
  if (!(await ensureAudioRunning())) return
  list.split(' ').forEach((id, i) => {
    window.setTimeout(() => playNote(midiOf(soundingFromWritten(parseNote(id))), 'piano'), i * gap * 1000)
  })
}

export type Art = () => ReactNode
