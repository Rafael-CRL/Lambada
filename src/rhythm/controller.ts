import { audioContext, clock } from '../audio/clock'
import { Metronome } from '../audio/metronome'
import { ToneScheduler } from '../audio/tones'
import { RHYTHM } from '../config'
import { barCells, cellBeats, FIGURE_BEATS, type CellId } from '../domain/rhythm'
import { percent, type Hud } from '../exercises/controller'
import { FrameLoop } from '../exercises/stage'
import type { LessonCard, LessonResult } from '../lessons/lessons'
import { cellValue, rhythmItems, valueFigure, type RhythmBody, type RhythmItem } from './items'
import { TapJudge } from './judge'
import { onsets, patternBeats, type RhythmPattern } from './patterns'

export type Mark = 'ok' | 'err' | null

export interface RhythmView {
  index: number
  total: number
  item: RhythmItem | null
  /**
   * card: cartão da parte · play: contagem, escuta e batida · result: marcas ·
   * write: montando o ritmo · ask: pergunta · answered: respondida · done
   */
  phase: 'card' | 'play' | 'result' | 'write' | 'ask' | 'answered' | 'done'
  card: LessonCard | null
  /** de quem é a vez agora: o app toca (listen), o aluno bate (tap) */
  turn: 'listen' | 'tap' | null
  /** acerto de cada evento do trecho (pausas ficam null) */
  marks: Mark[]
  /** batidas a mais, em pulsos a partir do começo do trecho */
  extras: number[]
  /** ritmo montado na escrita, por compasso */
  written: CellId[][]
  /** escrita conferida: acerto por compasso */
  writtenOk: boolean[] | null
  chosen: number | CellId | null
  right: boolean | null
}

/** Cursor e contagem, a cada quadro (fora do React). */
export interface RhythmFrame {
  /** posição no trecho, em pulsos; null = sem cursor */
  pos: number | null
  /** pulso atual no compasso (0 = cabeça), inclusive na contagem; null = parado */
  count: number | null
  countIn: boolean
}

export interface RhythmDeps {
  body: RhythmBody
  bpm: number
  toleranceMs: number
  /** compensação (ms) do atraso entre bater e o app registrar */
  tapLatencyMs: number
  rng?: () => number
  setView: (v: RhythmView) => void
  setHud: (patch: Partial<Hud>) => void
  onFrame?: (f: RhythmFrame) => void
  finish: (r: LessonResult) => void
}

interface Seg {
  kind: 'count' | 'listen' | 'tap'
  from: number
  to: number
}

interface Timeline {
  /** instante (relógio de áudio) do pulso 0 da linha do tempo */
  base: number
  meter: number
  segs: Seg[]
  end: number
  /** main: o trecho valendo · replay: o certo, depois de um erro · hear: ouvir para escrever */
  purpose: 'main' | 'replay' | 'hear'
}

const EMPTY: Omit<RhythmView, 'index' | 'total' | 'item' | 'phase'> = {
  card: null,
  turn: null,
  marks: [],
  extras: [],
  written: [],
  writtenOk: null,
  chosen: null,
  right: null,
}

const sum = (cells: CellId[]) => cells.reduce((s, c) => s + cellBeats(c), 0)

/**
 * Lição (ou prática) de ritmo: cada item é um trecho para imitar, ler ou
 * escrever, ou uma pergunta rápida. Um compasso de contagem antes; o
 * metrônomo marca o pulso o tempo todo. Errou: as notas perdidas ficam
 * vermelhas, o app toca o trecho certo e segue; o trecho volta mais adiante.
 */
export class RhythmController {
  private items: RhythmItem[]
  private i = 0
  private view: RhythmView
  private tl: Timeline | null = null
  private judge: TapJudge | null = null
  /** ataque i do juiz → índice do evento no trecho */
  private judgeEvents: number[] = []
  private metronomes = new Map<number, Metronome>()
  private tones: ToneScheduler | null = null
  private until = 0
  private after: (() => void) | null = null
  private seenCards = new Set<RhythmItem>()
  private retried = new Set<RhythmPattern>()
  private correct = 0
  private attempts = 0
  private started = false
  private finished = false
  private paused = false
  private loop = new FrameLoop((perf) => this.update(clock(perf)))
  private readonly spb: number
  private readonly tol: number

  constructor(private d: RhythmDeps) {
    this.items = rhythmItems(d.body, d.rng)
    this.spb = 60 / d.bpm
    this.tol = d.toleranceMs / 1000
    this.view = { index: 0, total: this.items.length, item: null, phase: 'card', ...EMPTY }
  }

  start() {
    this.started = true
    this.loop.start()
    this.enter()
  }

  get total(): number {
    return this.items.length
  }

  /** Itens já feitos (para decidir o que fazer ao sair). */
  get answered(): number {
    return this.i
  }

  private get item(): RhythmItem | null {
    return this.items[this.i] ?? null
  }

  private set(patch: Partial<RhythmView>) {
    this.view = { ...this.view, ...patch, index: this.i, total: this.items.length }
    this.d.setView(this.view)
  }

  /** Entra no item atual: o cartão da parte (uma vez) ou direto. */
  private enter() {
    const it = this.item
    if (!it) return this.done()
    this.hud()
    if (it.card && !this.seenCards.has(it)) {
      this.seenCards.add(it)
      this.set({ ...EMPTY, item: it, phase: 'card', card: it.card })
      return
    }
    this.begin()
  }

  /** Fecha o cartão (qualquer tecla ou clique). */
  continue() {
    if (this.view.phase === 'card' && !this.paused) this.begin()
  }

  private begin() {
    const it = this.item!
    this.set({ ...EMPTY, item: it, phase: 'play' })
    if (it.mode === 'imitate') this.play(it.pattern, ['listen', 'tap'], 'main')
    else if (it.mode === 'read') this.play(it.pattern, ['tap'], 'main')
    else if (it.mode === 'write') {
      this.set({ phase: 'write', written: it.pattern.bars.map(() => []) })
      this.play(it.pattern, ['listen'], 'hear')
    } else this.set({ phase: 'ask' })
  }

  // ------------------------------------------------------------- som

  private metronome(meter: number): Metronome {
    let m = this.metronomes.get(meter)
    if (!m) {
      m = new Metronome(this.d.bpm, meter)
      this.metronomes.set(meter, m)
    }
    return m
  }

  private toneOut(): ToneScheduler {
    this.tones ??= new ToneScheduler()
    return this.tones
  }

  private stopAudio() {
    for (const m of this.metronomes.values()) m.stop()
    this.tones?.stop()
  }

  /** Primeiro instante seguro para agendar som (o alto-falante está um pouco atrás do contexto). */
  private startTime(): number {
    const ahead = clock() + RHYTHM.lead
    const now = audioContext().currentTime
    return Number.isFinite(now) ? Math.max(ahead, now + 0.1) : ahead
  }

  /** Contagem + as vezes pedidas (o app toca, o aluno bate), com o metrônomo o tempo todo. */
  private play(p: RhythmPattern, turns: ('listen' | 'tap')[], purpose: Timeline['purpose']) {
    this.stopAudio()
    const m = p.meter
    const count = RHYTHM.countInBars * m
    const len = patternBeats(p)
    const segs: Seg[] = []
    let b = 0
    for (const t of turns) {
      segs.push({ kind: 'count', from: b, to: b + count })
      b += count
      segs.push({ kind: t, from: b, to: b + len })
      b += len
    }
    const base = this.startTime()
    this.tl = { base, meter: m, segs, end: b, purpose }
    this.metronome(m).start(base, 0, b - 1)
    for (const seg of segs)
      if (seg.kind === 'listen')
        for (const e of onsets(p)) this.toneOut().schedule(base + (seg.from + e.beat) * this.spb, FIGURE_BEATS[e.figure] * this.spb, RHYTHM.toneFreq)
    const tap = segs.find((s) => s.kind === 'tap')
    if (tap) {
      const os = onsets(p)
      this.judge = new TapJudge(
        os.map((e) => base + (tap.from + e.beat) * this.spb),
        this.tol,
      )
      this.judgeEvents = os.map((e) => e.index)
    } else this.judge = null
  }

  // ------------------------------------------------------------- batidas

  /** Batida do aluno (espaço, clique ou toque). Devolve acerto, batida a mais ou null (fora da vez). */
  tap(perfTime: number): 'ok' | 'err' | null {
    const tl = this.tl
    if (!this.judge || !tl || this.paused) return null
    const seg = tl.segs.find((s) => s.kind === 'tap')!
    const t = clock(perfTime) - this.d.tapLatencyMs / 1000
    const start = tl.base + seg.from * this.spb
    const end = tl.base + seg.to * this.spb
    if (t < start - this.tol || t > end + this.tol) return null
    const hit = this.judge.tap(t)
    if (hit === null) {
      this.set({ extras: [...this.view.extras, (t - start) / this.spb] })
      return 'err'
    }
    const marks = [...this.view.marks]
    marks[this.judgeEvents[hit]] = 'ok'
    this.set({ marks })
    return 'ok'
  }

  // ------------------------------------------------------------- escrita

  /** Acrescenta uma figura no primeiro compasso que ainda não está cheio. */
  addCell(id: CellId): boolean {
    const it = this.item
    if (this.view.phase !== 'write' || it?.mode !== 'write') return false
    const m = it.pattern.meter
    const written = this.view.written.map((b) => [...b])
    const bar = written.findIndex((b) => sum(b) < m)
    if (bar < 0 || sum(written[bar]) + cellBeats(id) > m) return false
    written[bar].push(id)
    this.set({ written })
    return true
  }

  /** Cabe no compasso atual? (para apagar os botões que não cabem) */
  fits(id: CellId): boolean {
    const it = this.item
    if (this.view.phase !== 'write' || it?.mode !== 'write') return false
    const bar = this.view.written.find((b) => sum(b) < it.pattern.meter)
    return !!bar && sum(bar) + cellBeats(id) <= it.pattern.meter
  }

  erase() {
    if (this.view.phase !== 'write') return
    const written = this.view.written.map((b) => [...b])
    for (let b = written.length - 1; b >= 0; b--)
      if (written[b].length) {
        written[b].pop()
        break
      }
    this.set({ written })
  }

  /** Ouvir de novo (escrita). */
  replay() {
    const it = this.item
    if (this.view.phase === 'write' && it?.mode === 'write') this.play(it.pattern, ['listen'], 'hear')
  }

  get writeComplete(): boolean {
    const it = this.item
    return it?.mode === 'write' && this.view.written.every((b) => sum(b) === it.pattern.meter)
  }

  /** Confere a escrita (Enter), compasso por compasso. */
  check() {
    const it = this.item
    if (this.view.phase !== 'write' || it?.mode !== 'write' || !this.writeComplete) return
    this.stopAudio()
    this.tl = null
    const writtenOk = it.pattern.bars.map((bar, b) => barCells(bar).join() === this.view.written[b].join())
    this.correct += writtenOk.filter(Boolean).length
    this.attempts += writtenOk.length
    const ok = writtenOk.every(Boolean)
    this.set({ phase: 'result', writtenOk, turn: null })
    this.hud()
    // errou: mostra o certo e toca
    this.wait(clock(), RHYTHM.resultTime, () => (ok ? this.next() : this.play(it.pattern, ['listen'], 'replay')))
  }

  // ------------------------------------------------------------- perguntas

  /** Resposta de "quantos pulsos" (número) ou "complete o compasso" (célula). */
  choose(v: number | CellId): boolean | null {
    const it = this.item
    if (this.view.phase !== 'ask' || !it) return null
    let right: boolean
    if (it.mode === 'value') right = v === cellValue(it.cell)
    else if (it.mode === 'complete') right = v === it.answer
    else return null
    if (right) this.correct++
    this.attempts++
    this.set({ phase: 'answered', chosen: v, right })
    this.hud()
    this.wait(clock(), this.demo(it) + 0.5, () => this.next())
    return right
  }

  /** Depois da resposta: a figura soando (com os cliques de cada pulso), ou o compasso completo. */
  private demo(it: RhythmItem): number {
    this.stopAudio()
    const base = this.startTime()
    if (it.mode === 'value') {
      const beats = cellValue(it.cell)
      const clicks = Math.ceil(beats)
      this.metronome(4).start(base, 0, clicks - 1)
      if (!valueFigure(it.cell).rest) this.toneOut().schedule(base, beats * this.spb, RHYTHM.toneFreq)
      return base - clock() + clicks * this.spb
    }
    if (it.mode === 'complete') {
      const m = it.pattern.meter
      this.metronome(m).start(base, 0, m - 1)
      for (const e of onsets(it.pattern)) this.toneOut().schedule(base + e.beat * this.spb, FIGURE_BEATS[e.figure] * this.spb, RHYTHM.toneFreq)
      return base - clock() + m * this.spb
    }
    return 0
  }

  // ------------------------------------------------------------- ciclo

  update(now: number) {
    if (this.finished || this.paused || !this.started) return
    const tl = this.tl
    if (tl) {
      const beat = (now - tl.base) / this.spb
      const seg = tl.segs.find((s) => beat >= s.from && beat < s.to) ?? null
      const turn = seg && seg.kind !== 'count' ? seg.kind : null
      if (turn !== this.view.turn) this.set({ turn })
      this.d.onFrame?.({
        pos: seg && seg.kind !== 'count' ? beat - seg.from : null,
        count: seg ? Math.floor(beat - seg.from) % tl.meter : null,
        countIn: seg?.kind === 'count',
      })
      if (this.judge) {
        const missed = this.judge.missedBy(now).filter((k) => this.view.marks[this.judgeEvents[k]] !== 'err')
        if (missed.length) {
          const marks = [...this.view.marks]
          for (const k of missed) marks[this.judgeEvents[k]] = 'err'
          this.set({ marks })
        }
      }
      if (beat >= tl.end + this.tol / this.spb) this.endTimeline(now)
    }
    if (this.after && now >= this.until) {
      const f = this.after
      this.after = null
      f()
    }
  }

  private endTimeline(now: number) {
    const tl = this.tl!
    this.tl = null
    this.d.onFrame?.({ pos: null, count: null, countIn: false })
    this.set({ turn: null })
    const it = this.item!
    if (tl.purpose === 'hear') return
    if (tl.purpose === 'replay') return this.wait(now, 0.3, () => this.next())
    const j = this.judge!
    this.judge = null
    const marks = [...this.view.marks]
    for (const k of j.missedBy(Infinity)) marks[this.judgeEvents[k]] = 'err'
    const { correct, attempts } = j.score
    this.correct += correct
    this.attempts += attempts
    const perfect = j.perfect
    if (!perfect && (it.mode === 'imitate' || it.mode === 'read')) this.retry(it)
    this.set({ phase: 'result', marks })
    this.hud()
    this.wait(now, RHYTHM.resultTime, () => {
      if (perfect || (it.mode !== 'imitate' && it.mode !== 'read')) return this.next()
      // o certo, tocado com o cursor, com as marcas ainda à vista
      this.set({ phase: 'play' })
      this.play(it.pattern, ['listen'], 'replay')
    })
  }

  /** O trecho errado volta `retryAfter` itens depois (uma vez só). */
  private retry(it: Extract<RhythmItem, { pattern: RhythmPattern }>) {
    if (this.retried.has(it.pattern) || it.mode === 'complete') return
    this.retried.add(it.pattern)
    const at = Math.min(this.i + 1 + RHYTHM.retryAfter, this.items.length)
    this.items.splice(at, 0, { mode: it.mode === 'imitate' ? 'imitate' : 'read', pattern: it.pattern, retry: true })
  }

  private wait(now: number, seconds: number, then: () => void) {
    this.until = now + seconds
    this.after = then
  }

  private next() {
    this.i++
    this.enter()
  }

  /** "?" aberto no meio: para o som e recomeça o item ao voltar. */
  pause() {
    if (this.finished) return
    this.paused = true
    this.stopAudio()
    this.tl = null
    this.judge = null
    this.d.onFrame?.({ pos: null, count: null, countIn: false })
  }

  resume() {
    if (!this.paused) return
    this.paused = false
    const phase = this.view.phase
    if (phase === 'card' || phase === 'done') return
    // pergunta respondida ou marcas à vista: segue; senão refaz o item
    if (this.after && (phase === 'answered' || phase === 'result')) {
      const f = this.after
      this.after = null
      return f()
    }
    this.after = null
    this.begin()
  }

  private done() {
    this.finished = true
    this.loop.stop()
    this.stopAudio()
    this.set({ ...EMPTY, item: null, phase: 'done' })
    this.d.finish({ correct: this.correct, attempts: this.attempts })
  }

  /** "+ N": mais trechos de leitura com as figuras da lição, na mesma tela. */
  more(count: number) {
    if (!this.finished) return
    const extra = rhythmItems({ ...this.d.body, parts: [{ mode: 'read', count }], challenge: false }, this.d.rng).map((it) => ({ ...it, card: undefined }))
    this.items.push(...extra)
    this.finished = false
    this.loop.start()
    this.enter()
  }

  private hud() {
    const done = Math.min(this.i, this.items.length)
    this.d.setHud({
      progress: done / Math.max(1, this.items.length),
      progressText: `${done}/${this.items.length}`,
      stats: [{ label: 'acerto', value: percent(this.correct, this.attempts) }],
    })
  }

  dispose() {
    this.finished = true
    this.loop.stop()
    this.stopAudio()
    for (const m of this.metronomes.values()) m.dispose()
    this.tones?.dispose()
  }
}
