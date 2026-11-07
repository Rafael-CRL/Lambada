import { memo, useEffect, useRef, useState } from 'react'
import { midiOf, namePt, parseNote } from '../domain/notes'
import { displayPosition } from '../domain/scales'
import { barlineShapes, clefShape, naturalStemEnd, noteShapes, restShapes, staffLines, timeSigShapes } from '../staff/geometry'
import { ShapeView } from '../staff/StaffSvg'
import { cx } from '../ui/controls'
import type { Study, WrittenNote } from './catalog'
import type { GuidedView } from './controller'
import { firstRow, pageGrid } from './pages'

const START = 96
const STEP = 62
const NO_MARKS: GuidedView['marks'] = {}

/** Um sistema por compasso: legível também no celular, com ambas as vozes. */
const Bar = memo(function Bar({ study, notes, index, active, marks, guide }: {
  study: Study; notes: WrittenNote[]; index: number; active: boolean; marks: GuidedView['marks']; guide: boolean;
}) {
  const width = START + study.meter * STEP + 22
  const arpeggio = notes.some((n) => n.voice === 'bass') && notes.some((n) => n.beat === 0.5)
  const beamNotes = notes.filter((n) => n.note && (n.figure === 'eighth' || (arpeggio && n.voice === 'bass')))
  const stem = { up: true, toY: Math.min(...beamNotes.map((n) => naturalStemEnd(parseNote(n.note!), true))) }
  const repeatEnd = study.order.some((bar, i) => bar === index && study.order[i + 1] !== undefined && study.order[i + 1] <= bar)
  return <svg viewBox={`0 -24 ${width} ${guide ? 224 : 204}`} className="staff h-auto w-full" role="img" aria-label={`${study.unmetered ? 'Sequência' : 'Compasso'} ${index + 1}`}>
    <g className="staff-bg">
      {staffLines(0, width - 8).map((s, i) => <ShapeView key={i} s={s} />)}
      <ShapeView s={clefShape()} />
      {!study.unmetered && timeSigShapes(study.meter, 49).map((s, i) => <ShapeView key={i} s={s} />)}
      <g transform={`translate(${width - 8} 0)`}>{barlineShapes(false, repeatEnd || index === study.bars.length - 1).map((s, i) => <ShapeView key={i} s={s} />)}
        {repeatEnd && <g fill="var(--color-sub)"><circle cx={-14} cy={57} r={1.7} /><circle cx={-14} cy={67} r={1.7} /></g>}
      </g>
    </g>
    {notes.map((n, i) => {
      const key = `${index}-${i}`
      const next = beamNotes[beamNotes.indexOf(n) + 1]
      const beamTo = next ? (next.beat - n.beat) * STEP : undefined
      const written = n.note ? parseNote(n.note) : null
      const position = n.position ?? (written ? displayPosition('solta', midiOf(written) - 12, true) : null)
      const shapes = written ? noteShapes(written, { figure: n.figure, natural: n.natural,
        up: n.voice ? n.voice === 'upper' : undefined,
        ...(n.figure === 'eighth' ? { stem, beamTo } : {}),
      }) : restShapes(n.figure === 'dotted-half' ? 'whole' : n.figure)
      return <g key={key} transform={`translate(${START + n.beat * STEP} 0)`} className={cx('note', active && marks[key] && `is-${marks[key]}`)}>
        <title>{written ? `${namePt(written)}${position ? ` · ${position.string}ª corda, casa ${position.fret}` : ''}` : 'Pausa'}</title>
        {shapes.map((s, j) => <ShapeView key={j} s={s} />)}
        {arpeggio && n.voice === 'bass' && written && noteShapes(written, { figure: 'eighth', stem, beamTo }).filter((s) => s.part === 'stem' || s.part === 'beam').map((s, j) => <ShapeView key={`beam-${j}`} s={s} />)}
        {guide && written && <>
          <text className="note-label" x={6} y={177} textAnchor="middle">{namePt(written)}</text>
          {position && <text className="note-label" x={6} y={191} textAnchor="middle" style={{ fontSize: 9 }}>{position.string}ª · {position.fret}</text>}
        </>}
        {guide && n.finger && <text className="note-label" x={6} y={Math.min(25, stem.toY - 10)} textAnchor="middle">{n.finger}</text>}
      </g>
    })}
  </svg>
})

export function GuidedScore({ study, view, guide, running, reserve }: { study: Study; view: GuidedView; guide: boolean; running: boolean; reserve: number }) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 960, height: 640 })
  const [manual, setManual] = useState(0)
  useEffect(() => {
    const measure = () => setSize({ width: box.current?.clientWidth ?? 960, height: Math.max(160, window.innerHeight - reserve) })
    measure()
    const observer = new ResizeObserver(measure)
    if (box.current) observer.observe(box.current)
    window.addEventListener('resize', measure)
    return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
  }, [reserve])
  const barWidth = START + study.meter * STEP + 22
  const { cols, rows } = pageGrid(size.width, size.height, (guide ? 224 : 204) / barWidth, study.bars.length)
  const totalRows = Math.ceil(study.bars.length / cols)
  const maxStart = Math.max(0, totalRows - rows)
  // Tocando, a página acompanha o cursor sozinha; parado, o aluno folheia.
  const start = running ? firstRow(Math.floor(view.bar / cols), rows, totalRows) : Math.min(manual, maxStart)
  const visible = study.bars.map((notes, index) => ({ notes, index })).slice(start * cols, (start + rows) * cols)
  return <div ref={box} className="flex flex-col gap-2">
    {!running && maxStart > 0 && <div className="flex items-center justify-end gap-2 text-xs text-sub">
      <button type="button" disabled={start === 0} onClick={() => setManual(Math.max(0, start - rows))} className="rounded-lg px-3 py-2 hover:bg-surface disabled:opacity-40">‹ anterior</button>
      <span>compassos {start * cols + 1}–{Math.min(study.bars.length, (start + rows) * cols)} de {study.bars.length}</span>
      <button type="button" disabled={start >= maxStart} onClick={() => setManual(Math.min(maxStart, start + rows))} className="rounded-lg px-3 py-2 hover:bg-surface disabled:opacity-40">próxima ›</button>
    </div>}
    <div className="grid items-start gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {visible.map(({ notes, index }) => {
        const active = view.bar === index
        return <div key={index} className={cx('relative rounded-xl border p-3 transition-colors', active && running ? 'border-accent/60 bg-surface' : 'border-line/40 bg-surface/30')}>
          <span className="absolute top-2 left-3 font-mono text-[10px] text-sub">{study.unmetered ? 'notas' : index + 1}</span>
          <Bar study={study} notes={notes} index={index} active={active} marks={active ? view.marks : NO_MARKS} guide={guide} />
          {study.id.startsWith('poco-andante') && (index === 7 || index === 15 || index === 8) && <span className="absolute right-3 bottom-2 text-[10px] text-sub">{index === 7 ? 'Fine' : index === 15 ? 'D.C. al Fine' : 'B'}</span>}
          {active && running && !view.done && <svg className="pointer-events-none absolute inset-3" style={{ width: 'calc(100% - 1.5rem)', height: 'calc(100% - 1.5rem)' }} viewBox={`0 -24 ${barWidth} ${guide ? 224 : 204}`} aria-hidden="true">
            <line x1={START + view.beat * STEP + 6} x2={START + view.beat * STEP + 6} y1={30} y2={125} stroke="var(--color-accent)" strokeWidth={3} opacity={0.4} />
          </svg>}
        </div>
      })}
    </div>
  </div>
}
