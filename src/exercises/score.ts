import { Metronome } from '../audio/metronome'
import { BPM, DETECTION, READING } from '../config'
import { namePt } from '../domain/notes'
import { generateBar, type Figure, type RhythmEvent, type RhythmLevel } from '../domain/rhythm'
import { scaleSequence, type StudyItem } from '../domain/scales'
import type { AttemptResult } from '../engine/adaptive'
import type { StudySession } from '../engine/session'
import { barlineShapes, beamedPairStems, restShapes, S, type NoteDraw } from '../staff/geometry'
import { Controller, judge, percent, type Answer, type ControllerDeps } from './controller'
import type { StageNote } from './stage'
import { DURATION_BARS, TIMED_SECONDS, type Content } from './types'

/** Pontuação de uma nota certa no metrônomo: base + precisão, vezes o multiplicador. */
export function scoreHit(offset: number, tolerance: number, multiplier: number): number {
  const precision = Math.max(0, 1 - Math.abs(offset) / tolerance)
  return Math.round((BPM.hitPoints + BPM.timingPoints * precision) * multiplier)
}

export function multiplierFor(combo: number): number {
  return Math.min(BPM.maxMultiplier, 1 + Math.floor(combo / BPM.comboStep))
}

/**
 * De onde vêm as notas: sorteio adaptativo, escala (sobe e desce) ou
 * repetição (a mesma nota no compasso inteiro).
 */
export class ContentSource {
  private seq: StudyItem[] = []
  private idx = 0
  private barItem: StudyItem | null = null

  constructor(
    readonly kind: Content,
    private session: StudySession,
  ) {
    if (kind === 'scale') this.seq = scaleSequence(session.items)
    // repetição: todas as notas da região, na ordem por corda (1ª corda primeiro)
    if (kind === 'repeat') this.seq = [...session.items]
  }

  /** Quantidade de unidades quando a sequência é fixa: notas (escala) ou compassos (repetição). */
  get length(): number | null {
    return this.kind === 'random' ? null : this.seq.length
  }

  get produced(): number {
    return this.idx
  }

  /** Chamado a cada compasso novo; false quando a repetição acabou. */
  newBar(): boolean {
    if (this.kind !== 'repeat') return true
    this.barItem = this.seq[this.idx] ?? null
    if (!this.barItem) return false
    this.idx++
    this.session.presented(this.barItem.id)
    return true
  }

  next(): StudyItem | null {
    if (this.kind === 'scale') {
      const item = this.seq[this.idx] ?? null
      if (item) {
        this.idx++
        this.session.presented(item.id)
      }
      return item
    }
    if (this.kind === 'repeat') return this.barItem
    this.idx++
    return this.session.next()
  }
}

interface ScoreEvent {
  beat: number
  figure: Figure
  rest: boolean
  beam?: 'start' | 'end'
  barStart: boolean
  item: StudyItem | null
  pairStem?: { up: boolean; toY: number }
  sn?: StageNote
  bar?: StageNote
  x: number
  spawned: boolean
  resolved: boolean
  /** primeira resposta (a única registrada no motor) */
  first: AttemptResult | null
  headSince: number | null
  revealUntil: number
}

/**
 * A partitura rolando em compassos 4/4.
 * - Tempo livre: a nota na linha espera a resposta; as seguintes aguardam atrás.
 * - Metrônomo: x = linha + (instante do tempo − agora) × velocidade, no relógio de áudio.
 */
export class ScoreController extends Controller {
  private readonly metro: boolean
  private readonly level: RhythmLevel
  private spb: number
  private readonly beatPx: number
  private readonly tol: number
  /** o microfone só confirma a nota ~150 ms após o ataque */
  private readonly grace: number
  private readonly maxBars: number | null
  private readonly timed: boolean
  private readonly content: ContentSource
  private readonly rng: () => number
  private metronome: Metronome | null = null
  private events: ScoreEvent[] = []
  private bars = 0
  private exhausted = false
  private base = 0
  private startedAt = 0
  private countInTo = 0
  private lastCount: string | null = null
  private endAt: number | null = null
  private lastHud = -1
  // placar
  private attempted = 0
  private hits = 0
  private hitTimes: number[] = []
  private score = 0
  private combo = 0
  private maxCombo = 0
  private offsets: number[] = []

  constructor(d: ControllerDeps, rng: () => number = Math.random) {
    super(d)
    const c = d.config
    this.metro = c.tempo === 'metronome'
    this.level = (this.metro ? c.level : 1) as RhythmLevel
    this.spb = 60 / c.bpm
    this.beatPx = (this.metro && this.level >= 4 ? BPM.beatSpacingEighths : BPM.beatSpacing) * S
    this.tol = d.settings.toleranceMs / 1000
    this.grace = d.mic ? DETECTION.attackIgnore + DETECTION.stableTime + 0.12 : 0
    this.content = new ContentSource(c.content, d.session)
    this.timed = !this.metro && c.content === 'random' && c.duration === 'timed'
    this.maxBars = c.content === 'random' && (c.duration === 'short' || c.duration === 'long') ? DURATION_BARS[c.duration] : null
    this.rng = rng
    if (this.metro) this.metronome = new Metronome(c.bpm)
  }

  // ------------------------------------------------------------- partitura

  private makeBar(): RhythmEvent[] {
    if (this.metro) return generateBar(this.level, this.rng, BPM.beatsPerBar)
    return [0, 1, 2, 3].map((b) => ({ figure: 'quarter' as Figure, rest: false, beatInBar: b }))
  }

  /** Gera compassos até cobrir `uptoBeat` (sob demanda, para o sorteio seguir o desempenho). */
  private extend(uptoBeat: number) {
    while (!this.exhausted && this.bars * BPM.beatsPerBar <= uptoBeat) {
      if (this.maxBars !== null && this.bars >= this.maxBars) {
        this.exhausted = true
        break
      }
      const barBeat = this.bars * BPM.beatsPerBar
      if (!this.content.newBar()) {
        this.exhausted = true
        break
      }
      const out: ScoreEvent[] = []
      for (const e of this.makeBar()) {
        const ev: ScoreEvent = {
          beat: barBeat + e.beatInBar,
          figure: e.figure,
          rest: e.rest,
          beam: e.beam,
          barStart: out.length === 0,
          item: null,
          x: Infinity,
          spawned: false,
          resolved: e.rest,
          first: null,
          headSince: null,
          revealUntil: 0,
        }
        if (!e.rest) {
          ev.item = this.content.next()
          if (!ev.item) {
            this.exhausted = true
            break
          }
        }
        out.push(ev)
      }
      // colcheia sem par (sequência acabou no meio): vira colcheia simples
      const last = out[out.length - 1]
      if (last?.beam === 'start') last.beam = undefined
      for (let i = 0; i < out.length; i++) {
        const e = out[i]
        if (e.beam === 'start' && out[i + 1]?.item && e.item) {
          const stems = beamedPairStems(e.item.written, out[i + 1].item!.written)
          e.pairStem = stems
          out[i + 1].pairStem = stems
        }
      }
      if (out.length === 0) break
      this.events.push(...out)
      this.bars++
    }
  }

  private get head(): ScoreEvent | undefined {
    return this.events.find((e) => !e.resolved)
  }

  private timeOf(beat: number) {
    return this.base + beat * this.spb
  }

  /** x alvo de um evento: no metrônomo, função do tempo; no livre, da nota que espera. */
  private targetX(e: ScoreEvent, now: number): number {
    const hit = this.d.stage.hitNoteX
    if (this.metro) return hit + (this.timeOf(e.beat) - now) * (this.beatPx / this.spb)
    const headBeat = this.head?.beat ?? (this.events.at(-1)?.beat ?? 0) + 1
    return hit + (e.beat - headBeat) * this.beatPx
  }

  private spawn(e: ScoreEvent, x: number) {
    const stage = this.d.stage
    e.spawned = true
    e.x = x
    if (e.barStart && e.beat > 0) e.bar = stage.addShapes(barlineShapes(), x - 0.3 * this.beatPx, 'is-bar')
    if (e.rest) {
      e.sn = stage.addShapes(restShapes(e.figure), x, 'is-rest')
      return
    }
    const item = e.item!
    let draw: NoteDraw = { figure: e.figure }
    if (e.pairStem) {
      draw = { figure: 'eighth', stem: e.pairStem, beamTo: e.beam === 'start' ? this.beatPx / 2 : undefined }
    }
    // sem nome sob a nota: a leitura é o exercício (o nome só aparece no erro)
    e.sn = stage.addNote(item.written, x, undefined, draw)
  }

  // ------------------------------------------------------------- ciclo

  protected begin(now: number) {
    this.startedAt = now
    if (this.metro) this.scheduleFrom(0, now)
    this.extend(8)
    const h = this.head
    if (h) h.headSince = now
    this.hud(now)
  }

  /** Metrônomo: um compasso de contagem e (re)começo no tempo `beat`. */
  private scheduleFrom(beat: number, now: number) {
    const countIn = BPM.countInBars * BPM.beatsPerBar
    this.countInTo = beat
    this.base = now + 0.25 + countIn * this.spb - beat * this.spb
    this.metronome!.start(this.clock.toApp(this.base), beat - countIn)
  }

  protected onPause() {
    this.metronome?.stop()
  }

  protected onResume() {
    if (!this.metro) return
    const pending = this.head
    this.scheduleFrom(Math.floor(pending ? pending.beat : (this.events.at(-1)?.beat ?? 0) + 1), this.clock.now())
  }

  protected update(now: number, dt: number) {
    const stage = this.d.stage
    const visibleBeats = Math.ceil(stage.width / this.beatPx) + 2
    const currentBeat = this.metro ? (now - this.base) / this.spb : (this.head?.beat ?? 0)
    this.extend(currentBeat + visibleBeats)

    const step = READING.waitSpeed * S * dt
    for (const e of this.events) {
      const target = this.targetX(e, now)
      if (!e.spawned) {
        if (target < stage.width + 2 * S) this.spawn(e, this.metro ? target : Math.max(target, stage.width + S))
        continue
      }
      // livre: aproxima do alvo; metrônomo: posição exata no tempo
      e.x = this.metro ? target : Math.max(target, e.x - step)
      e.sn?.setX(e.x)
      e.bar?.setX(e.x - 0.3 * this.beatPx)
      if (e.revealUntil && now > e.revealUntil) {
        e.revealUntil = 0
        e.sn?.setLabel('', 0)
      }
      if (this.metro && !e.resolved && now > this.timeOf(e.beat) + this.tol + this.grace) this.miss(e, now)
    }
    // o que saiu pela esquerda
    const gone = this.events.filter((e) => e.spawned && e.x < -3 * S)
    if (gone.length) {
      for (const e of gone) {
        e.sn?.remove()
        e.bar?.remove()
      }
      this.events = this.events.filter((e) => !gone.includes(e))
    }

    if (this.metro) this.updateCountdown(now)
    if (this.timed && now - this.startedAt >= TIMED_SECONDS) this.end(now)
    if (this.exhausted && !this.head) {
      this.endAt ??= now + (this.metro ? this.grace + 0.6 : 0.6)
      if (now >= this.endAt) this.end(now)
    }
    if (now - this.lastHud >= 0.1) this.hud(now)
  }

  private updateCountdown(now: number) {
    const beat = Math.floor((now - this.base) / this.spb + 1e-6)
    const to = this.countInTo
    const count = beat < to && beat >= to - BPM.countInBars * BPM.beatsPerBar ? String(to - beat) : null
    if (count !== this.lastCount) {
      this.lastCount = count
      this.d.setHud({ countdown: count })
    }
  }

  protected target(): StudyItem | null {
    if (!this.metro) return this.head?.item ?? null
    const now = this.clock.now()
    let best: ScoreEvent | null = null
    for (const e of this.events) {
      if (e.resolved || !e.spawned) continue
      if (!best || Math.abs(this.timeOf(e.beat) - now) < Math.abs(this.timeOf(best.beat) - now)) best = e
    }
    return best?.item ?? null
  }

  // ------------------------------------------------------------- respostas

  protected answer(a: Answer): AttemptResult | null {
    return this.metro ? this.answerMetro(a) : this.answerFree(a)
  }

  private record(e: ScoreEvent, result: AttemptResult, rt: number) {
    e.first = result
    this.attempted++
    if (result === 'correct') {
      this.hits++
      this.hitTimes.push(rt)
    }
    this.announceUnlocks(this.d.session.record(e.item!.id, result, rt))
  }

  private answerFree(a: Answer): AttemptResult | null {
    const e = this.head
    if (!e?.item || !e.spawned) return null
    const result = judge(e.item, a)
    if (!e.first) this.record(e, result, Math.max(0, a.time - (e.headSince ?? a.time)))
    if (result === 'correct') {
      e.resolved = true
      e.sn?.setState(e.first === 'correct' ? 'ok' : null)
      this.feedback('ok', '')
      this.d.setHud({ fret: null })
      const next = this.head
      if (next) next.headSince = a.time
    } else {
      this.reveal(e, result, a)
    }
    this.hud(a.time)
    return result
  }

  private answerMetro(a: Answer): AttemptResult | null {
    let best: ScoreEvent | null = null
    for (const e of this.events) {
      if (e.resolved || !e.spawned) continue
      const dt = Math.abs(a.time - this.timeOf(e.beat))
      if (dt <= this.tol && (!best || dt < Math.abs(a.time - this.timeOf(best.beat)))) best = e
    }
    if (!best) {
      this.feedback('info', 'fora do tempo')
      return null
    }
    const e = best
    const offset = a.time - this.timeOf(e.beat)
    const result = judge(e.item!, a)
    e.resolved = true
    this.record(e, result, this.spb)
    if (result === 'correct') {
      this.combo++
      this.maxCombo = Math.max(this.maxCombo, this.combo)
      this.offsets.push(offset)
      const pts = scoreHit(offset, this.tol, multiplierFor(this.combo - 1))
      this.score += pts
      e.sn?.setState('ok')
      this.d.setHud({ fret: null })
      const ms = Math.round(offset * 1000)
      this.feedback('ok', `+${pts}`, ms === 0 ? 'no tempo' : `${Math.abs(ms)} ms ${ms < 0 ? 'adiantado' : 'atrasado'}`)
    } else {
      this.combo = 0
      this.reveal(e, result, a)
    }
    this.hud(a.time)
    return result
  }

  private reveal(e: ScoreEvent, result: AttemptResult, a: Answer | null) {
    const item = e.item!
    e.sn?.setState(result === 'wrong-octave' ? 'oct' : 'err')
    e.sn?.setLabel(namePt(item.written), 1)
    e.revealUntil = (a?.time ?? this.clock.now()) + READING.revealTime
    if (a?.kind === 'mic') this.micMistake(item, a.writtenMidi, result, e.sn)
    else if (a === null) this.feedback('err', namePt(item.written), 'passou')
    else this.feedback('err', namePt(item.written), 'era esta')
  }

  private miss(e: ScoreEvent, now: number) {
    e.resolved = true
    this.combo = 0
    this.record(e, 'wrong', this.spb)
    this.reveal(e, 'wrong', null)
    this.hud(now)
  }

  // ------------------------------------------------------------- fim e placar

  private end(now: number) {
    this.metronome?.stop()
    this.hud(now)
    if (!this.metro) return this.complete()
    const mean = (xs: number[]) => (xs.length ? xs.reduce((s, o) => s + o, 0) / xs.length : NaN)
    const meanAbs = mean(this.offsets.map(Math.abs))
    const meanSigned = mean(this.offsets)
    this.complete({
      bpm: this.d.config.bpm,
      rhythmLevel: this.level,
      score: this.score,
      maxCombo: this.maxCombo,
      meanOffsetMs: Number.isFinite(meanAbs) ? Math.round(meanAbs * 1000) : undefined,
      meanSignedOffsetMs: Number.isFinite(meanSigned) ? Math.round(meanSigned * 1000) : undefined,
    })
  }

  /** Barra de progresso (null = sem fim, sem barra) e texto ao lado. */
  private progress(now: number): { value: number | null; text: string } {
    if (this.timed) {
      const left = Math.max(0, TIMED_SECONDS - (now - this.startedAt))
      return { value: 1 - left / TIMED_SECONDS, text: `${Math.ceil(left)} s` }
    }
    const len = this.content.length
    if (this.content.kind === 'scale' && len) {
      const done = this.content.produced - this.events.filter((e) => !e.rest && !e.resolved).length
      return { value: done / len, text: `${done}/${len}` }
    }
    const headBeat = this.head?.beat ?? this.bars * BPM.beatsPerBar
    const bar = Math.floor(headBeat / BPM.beatsPerBar) + 1
    const total = this.content.kind === 'repeat' ? len : this.maxBars
    if (total) return { value: headBeat / (total * BPM.beatsPerBar), text: `${Math.min(bar, total)}/${total}` }
    return { value: null, text: '' }
  }

  private hud(now: number) {
    this.lastHud = now
    const p = this.progress(now)
    // um número só: pontos no metrônomo, acertos no desafio de 60 s, senão acerto %
    const stat = this.metro
      ? { label: 'pontos', value: String(this.score) }
      : this.timed
        ? { label: 'acertos', value: String(this.hits) }
        : { label: 'acerto', value: percent(this.hits, this.attempted) }
    this.d.setHud({ progress: p.value, progressText: p.text, stats: [stat] })
  }

  /** Muda o andamento sem reiniciar: vale a partir do próximo tempo. */
  setBpm(bpm: number) {
    if (!this.metro || !this.metronome) return
    const now = this.clock.now()
    const nextBeat = Math.max(Math.ceil((now - this.base) / this.spb), this.countInTo - BPM.countInBars * BPM.beatsPerBar)
    const at = this.timeOf(nextBeat)
    this.spb = 60 / bpm
    this.base = at - nextBeat * this.spb
    this.metronome.dispose()
    this.metronome = new Metronome(bpm)
    if (!this.paused) this.metronome.start(this.clock.toApp(this.base), nextBeat)
  }

  /** Quantas notas já foram respondidas (para decidir se mostra o resumo ao sair). */
  get answered(): number {
    return this.attempted
  }

  dispose() {
    super.dispose()
    this.metronome?.dispose()
  }
}
