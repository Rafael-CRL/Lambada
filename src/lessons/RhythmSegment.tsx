import { useEffect, useMemo, useRef, useState } from 'react'
import { RHYTHM } from '../config'
import { barFromCells, cellBeats, cellEvents, type CellId } from '../domain/rhythm'
import type { Feedback } from '../exercises/controller'
import { ExerciseBody, FeedbackLine, PartCard } from '../exercises/parts'
import { RhythmController, type RhythmFrame, type RhythmView } from '../rhythm/controller'
import { Palette, TapPad } from '../rhythm/controls'
import { beatsLabel, cellValue, valueFigure, type RhythmBody } from '../rhythm/items'
import { placed } from '../rhythm/patterns'
import { BeatCount, FigureGlyph, RhythmStaff, type RhythmStaffHandle } from '../rhythm/RhythmStaff'
import { ChoiceButtons, type Choice } from '../ui/ChoiceButtons'
import type { SegmentProps } from './segments'

/** Retorno sob a pauta, derivado do estado do ritmo. */
function feedbackOf(v: RhythmView, key: number): Feedback | null {
  const it = v.item
  if (!it) return null
  if (v.phase === 'result' && (it.mode === 'imitate' || it.mode === 'read')) {
    const notes = v.marks.filter((m) => m !== undefined && m !== null)
    const ok = notes.filter((m) => m === 'ok').length
    const total = placed(it.pattern).filter((e) => !e.rest).length
    const perfect = ok === total && v.extras.length === 0
    if (perfect) return { kind: 'ok', text: 'certo!', key }
    const extra = v.extras.length ? ` · ${v.extras.length} a mais` : ''
    return { kind: 'err', text: `${ok} de ${total}`, detail: `ouça o certo${extra}`, key }
  }
  if (v.phase === 'result' && it.mode === 'write' && v.writtenOk) {
    return v.writtenOk.every(Boolean) ? { kind: 'ok', text: 'certo!', key } : { kind: 'err', text: 'quase', detail: 'ouça o certo', key }
  }
  if (v.phase === 'answered' && it.mode === 'value') {
    const right = beatsLabel(cellValue(it.cell))
    const unit = cellValue(it.cell) > 1 ? 'pulsos' : 'pulso'
    return v.right ? { kind: 'ok', text: `${right} ${unit}`, key } : { kind: 'err', text: `${right} ${unit}`, detail: 'era esta', key }
  }
  if (v.phase === 'answered' && it.mode === 'complete') return v.right ? { kind: 'ok', text: 'certo!', key } : { kind: 'err', text: 'era esta', key }
  return null
}

/** O que se pede, em poucas palavras, acima da pauta (a vez de cada um fica na área de bater). */
function promptOf(v: RhythmView): string {
  const it = v.item
  if (!it) return ''
  if (it.mode === 'value') return 'quantos pulsos dura?'
  if (it.mode === 'complete') return 'que figura completa o compasso?'
  if (it.mode === 'write') return 'ouça e escreva'
  if (it.mode === 'imitate') return 'ouça e repita'
  return 'leia e bata'
}

/** Ritmo: imitar, ler, escrever e as perguntas rápidas, com contagem e metrônomo. */
export function RhythmSegment({ body, settings, paused, hud, setHud, onDone, handle, dock }: SegmentProps<RhythmBody>) {
  const ctrl = useRef<RhythmController | null>(null)
  const staff = useRef<RhythmStaffHandle>(null)
  const [view, setView] = useState<RhythmView | null>(null)
  const [count, setCount] = useState<{ count: number | null; countIn: boolean }>({ count: null, countIn: false })
  const countRef = useRef(count)
  const fbKey = useRef(0)
  const kind = body.staff ?? 'line'

  useEffect(() => {
    const onFrame = (f: RhythmFrame) => {
      staff.current?.setCursor(f.pos)
      const cur = countRef.current
      if (cur.count !== f.count || cur.countIn !== f.countIn) {
        countRef.current = { count: f.count, countIn: f.countIn }
        setCount(countRef.current)
      }
    }
    const c = new RhythmController({
      body,
      bpm: body.bpm ?? RHYTHM.bpm,
      toleranceMs: settings.toleranceMs,
      tapLatencyMs: settings.tapLatencyMs,
      setView,
      setHud,
      onFrame,
      finish: onDone,
    })
    ctrl.current = c
    handle.current = { more: (n) => c.more(n), answered: () => c.answered }
    if (import.meta.env.DEV) (window as unknown as { __lambada: unknown }).__lambada = { controller: c }
    c.start()
    return () => {
      c.dispose()
      ctrl.current = null
    }
    // um controlador por segmento montado
  }, [])

  useEffect(() => {
    if (paused) ctrl.current?.pause()
    else ctrl.current?.resume()
  }, [paused])

  // cartão da parte: qualquer tecla segue
  useEffect(() => {
    if (view?.phase !== 'card') return
    const onKey = (e: KeyboardEvent) => {
      if (paused || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.key === 'Escape' || e.key === 'Tab') return
      if (e.key === 'Enter' || e.key === ' ') e.preventDefault()
      ctrl.current?.continue()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view?.phase, paused])

  const feedback = useMemo(() => (view ? feedbackOf(view, ++fbKey.current) : null), [view])
  const it = view?.item ?? null
  const meter = it && 'pattern' in it ? it.pattern.meter : 4

  const valueChoices = useMemo<Choice<number>[]>(
    () => (it?.mode === 'value' ? it.options.map((v, i) => ({ value: v, label: beatsLabel(v), hotkey: String(i + 1), aria: `${beatsLabel(v)} pulsos` })) : []),
    [it],
  )
  const completeChoices = useMemo<Choice<CellId>[]>(
    () =>
      it?.mode === 'complete'
        ? it.options.map((c, i) => ({ value: c, label: <FigureGlyph events={cellEvents(c)} className="h-12 sm:h-14" />, hotkey: String(i + 1), aria: `figura de ${cellBeats(c)} pulsos` }))
        : [],
    [it],
  )

  const choose = (v: number | CellId) => ctrl.current?.choose(v) ?? null

  let footer = null
  if (it && (it.mode === 'imitate' || it.mode === 'read'))
    footer = <TapPad turn={view?.phase === 'play' ? view.turn : null} disabled={paused} onTap={(t) => ctrl.current?.tap(t) ?? null} />
  else if (it?.mode === 'write')
    footer = (
      <Palette
        cells={body.cells}
        fits={(id) => ctrl.current?.fits(id) ?? false}
        onAdd={(id) => ctrl.current?.addCell(id)}
        onErase={() => ctrl.current?.erase()}
        onReplay={() => ctrl.current?.replay()}
        onCheck={() => ctrl.current?.check()}
        canCheck={!!ctrl.current?.writeComplete}
        disabled={paused || view?.phase !== 'write'}
      />
    )
  else if (it?.mode === 'value') footer = <ChoiceButtons label="Quantos pulsos" choices={valueChoices} disabled={paused || view?.phase !== 'ask'} onChoose={(v) => choose(v)} />
  else if (it?.mode === 'complete') footer = <ChoiceButtons label="Que figura" choices={completeChoices} disabled={paused || view?.phase !== 'ask'} onChoose={(v) => choose(v)} />

  return (
    <ExerciseBody
      footer={
        <>
          {dock && <div className="flex justify-end">{dock}</div>}
          {footer}
        </>
      }
    >
      <div className="flex min-h-[clamp(180px,40dvh,380px)] flex-col items-center justify-center gap-4">
        <span className="text-sm text-sub">{view && view.phase !== 'card' ? promptOf(view) : ''}</span>
        {it && view && <RhythmItemView view={view} kind={kind} meter={meter} staffRef={staff} />}
        {it && (it.mode === 'imitate' || it.mode === 'read' || (it.mode === 'write' && view?.phase !== 'result')) && (
          <BeatCount meter={meter} count={count.count} countIn={count.countIn} />
        )}
      </div>
      <FeedbackLine fb={feedback ?? hud.feedback} />
      {view?.phase === 'card' && view.card && <PartCard title={view.card.title} detail={view.card.detail} onClick={() => ctrl.current?.continue()} />}
    </ExerciseBody>
  )
}

/** O desenho de cada tipo de item. */
function RhythmItemView({ view, kind, meter, staffRef }: { view: RhythmView; kind: 'line' | 'staff'; meter: number; staffRef: React.RefObject<RhythmStaffHandle | null> }) {
  const it = view.item!
  // um compasso não estica até a largura de dois (as figuras ficariam enormes)
  const cls = 'pattern' in it && it.pattern.bars.length === 1 ? 'w-full max-w-lg' : 'w-full max-w-3xl'
  if (it.mode === 'value') {
    const f = valueFigure(it.cell)
    return <FigureGlyph events={[{ figure: f.figure, rest: f.rest }]} className="h-28 sm:h-36" />
  }
  if (it.mode === 'complete') {
    const state = view.phase === 'answered' ? (view.right ? 'ok' : 'err') : 'ask'
    return <RhythmStaff ref={staffRef} bars={it.pattern.bars} meter={meter} kind={kind} gap={{ index: it.gap, state }} className={cls} />
  }
  if (it.mode === 'write') {
    const written = view.written.map((cells) => barFromCells(cells))
    const empty = view.written.map((cells) => meter - cells.reduce((s, c) => s + cellBeats(c), 0))
    const wrong = view.writtenOk && !view.writtenOk.every(Boolean)
    return (
      <div className="flex w-full flex-col items-center gap-2">
        <RhythmStaff ref={wrong ? undefined : staffRef} bars={written} meter={meter} kind={kind} empty={empty} barMarks={view.writtenOk ?? undefined} className={cls} minBars={it.pattern.bars.length} ariaLabel="Seu ritmo" />
        {wrong && (
          <>
            <span className="text-xs text-sub">o certo</span>
            <RhythmStaff ref={staffRef} bars={it.pattern.bars} meter={meter} kind={kind} className={cls} ariaLabel="Ritmo certo" />
          </>
        )}
      </div>
    )
  }
  return <RhythmStaff ref={staffRef} bars={it.pattern.bars} meter={meter} kind={kind} marks={view.marks} extras={view.extras} className={cls} />
}
