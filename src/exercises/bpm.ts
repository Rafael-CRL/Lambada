import { Metronome } from '../audio/metronome'
import { BPM, DETECTION } from '../config'
import { midiOf, namePt } from '../domain/notes'
import type { StudyItem } from '../domain/scales'
import type { AttemptResult } from '../engine/adaptive'
import { S } from '../staff/geometry'
import { Controller, judge, octaveHint, percent, type Answer, type ControllerDeps } from './controller'
import type { StageNote } from './stage'

interface BeatNote {
  index: number
  item: StudyItem
  sn: StageNote
  resolved: boolean
}

/** Pontuação de uma nota certa: base + precisão, vezes o multiplicador. */
export function scoreHit(offset: number, tolerance: number, multiplier: number): number {
  const precision = Math.max(0, 1 - Math.abs(offset) / tolerance)
  return Math.round((BPM.hitPoints + BPM.timingPoints * precision) * multiplier)
}

export function multiplierFor(combo: number): number {
  return Math.min(BPM.maxMultiplier, 1 + Math.floor(combo / BPM.comboStep))
}

/**
 * Modo BPM: semínimas em 4/4 com metrônomo. A posição de cada nota é função
 * direta do relógio de áudio: x = linha + (instante do tempo − agora) × velocidade.
 */
export class BpmController extends Controller {
  private metronome: Metronome
  private readonly spb: number
  private readonly pxPerSec: number
  private readonly total: number
  private readonly tol: number
  /** o microfone só confirma a nota ~150 ms após o ataque: espera antes de dar "passou" */
  private readonly grace: number
  /** instante (relógio do exercício) do tempo 0 = primeira nota */
  private base = 0
  private notes: BeatNote[] = []
  private nextIndex = 0
  private score = 0
  private combo = 0
  private maxCombo = 0
  private hits = 0
  private judged = 0
  private offsets: number[] = []
  private lastCount: string | null = null
  /** primeira nota depois da contagem atual */
  private countInTo = 0

  constructor(d: ControllerDeps) {
    super(d)
    const bpm = d.settings.bpm
    this.spb = 60 / bpm
    this.pxPerSec = (BPM.beatSpacing * S) / this.spb
    this.total = Math.ceil(d.settings.sessionLength / BPM.beatsPerBar) * BPM.beatsPerBar
    this.tol = d.settings.toleranceMs / 1000
    this.grace = d.mic ? DETECTION.attackIgnore + DETECTION.stableTime + 0.12 : 0
    this.metronome = new Metronome(bpm)
  }

  protected begin(now: number) {
    this.scheduleFrom(0, now)
    this.hud()
  }

  /** Contagem de 1 compasso e retomada a partir da nota `index`. */
  private scheduleFrom(index: number, now: number) {
    const countIn = BPM.countInBars * BPM.beatsPerBar
    this.countInTo = index
    this.base = now + 0.25 + countIn * this.spb - index * this.spb
    this.metronome.start(this.clock.toApp(this.base), index - countIn, this.total - 1)
  }

  private timeOf(index: number) {
    return this.base + index * this.spb
  }

  protected onPause() {
    this.metronome.stop()
  }

  protected onResume() {
    const pending = this.notes.find((n) => !n.resolved)
    this.scheduleFrom(pending ? pending.index : this.nextIndex, this.clock.now())
  }

  protected update(now: number) {
    const stage = this.d.stage
    // cria as notas que estão para entrar pela direita
    while (this.nextIndex < this.total && stage.hitNoteX + (this.timeOf(this.nextIndex) - now) * this.pxPerSec < stage.width + 2 * S) {
      const item = this.d.session.next()
      const o = this.d.session.labelOpacity(item.id)
      const sn = stage.addNote(item.written, stage.width + 2 * S, { text: o > 0 ? namePt(item.written) : '', opacity: o })
      this.notes.push({ index: this.nextIndex++, item, sn, resolved: false })
    }
    for (const n of this.notes) {
      n.sn.setX(stage.hitNoteX + (this.timeOf(n.index) - now) * this.pxPerSec)
      if (!n.resolved && now > this.timeOf(n.index) + this.tol + this.grace) this.miss(n)
    }
    const gone = this.notes.filter((n) => n.sn.x < -3 * S)
    gone.forEach((n) => n.sn.remove())
    if (gone.length) this.notes = this.notes.filter((n) => !gone.includes(n))

    // contagem regressiva no compasso inicial
    const beat = Math.floor((now - this.base) / this.spb + 1e-6)
    const to = this.countInTo
    const count = beat < to && beat >= to - BPM.countInBars * BPM.beatsPerBar ? String(to - beat) : null
    if (count !== this.lastCount) {
      this.lastCount = count
      this.d.setHud({ countdown: count })
    }

    if (this.nextIndex >= this.total && now > this.timeOf(this.total - 1) + this.tol + this.grace + 0.6) this.end()
  }

  private miss(n: BeatNote) {
    n.resolved = true
    this.judged++
    this.combo = 0
    this.announceUnlocks(this.d.session.record(n.item.id, 'wrong', this.spb))
    n.sn.setState('err')
    n.sn.setLabel(namePt(n.item.written), 1)
    this.feedback('err', namePt(n.item.written), 'passou')
    this.hud()
  }

  protected answer(a: Answer): AttemptResult | null {
    let best: BeatNote | null = null
    for (const n of this.notes) {
      if (n.resolved) continue
      const dt = Math.abs(a.time - this.timeOf(n.index))
      if (dt <= this.tol && (!best || dt < Math.abs(a.time - this.timeOf(best.index)))) best = n
    }
    if (!best) {
      this.feedback('info', 'fora do tempo')
      return null
    }
    const n = best
    const offset = a.time - this.timeOf(n.index)
    const result = judge(n.item, a)
    n.resolved = true
    this.judged++
    this.announceUnlocks(this.d.session.record(n.item.id, result, this.spb))
    if (result === 'correct') {
      this.hits++
      this.combo++
      this.maxCombo = Math.max(this.maxCombo, this.combo)
      this.offsets.push(offset)
      const pts = scoreHit(offset, this.tol, multiplierFor(this.combo - 1))
      this.score += pts
      n.sn.setState('ok')
      const ms = Math.round(offset * 1000)
      this.feedback('ok', `+${pts}`, ms === 0 ? 'no tempo' : `${Math.abs(ms)} ms ${ms < 0 ? 'adiantado' : 'atrasado'}`)
    } else {
      this.combo = 0
      n.sn.setState(result === 'wrong-octave' ? 'oct' : 'err')
      n.sn.setLabel(namePt(n.item.written), 1)
      if (result === 'wrong-octave' && a.kind === 'mic')
        this.feedback('oct', 'nota certa, oitava errada', octaveHint(midiOf(n.item.written), a.writtenMidi))
      else this.feedback('err', namePt(n.item.written), 'era esta')
    }
    this.hud()
    return result
  }

  private end() {
    this.metronome.stop()
    const meanAbs = this.offsets.length ? this.offsets.reduce((s, o) => s + Math.abs(o), 0) / this.offsets.length : NaN
    const meanSigned = this.offsets.length ? this.offsets.reduce((s, o) => s + o, 0) / this.offsets.length : NaN
    this.complete({
      bpm: this.d.settings.bpm,
      score: this.score,
      maxCombo: this.maxCombo,
      meanOffsetMs: Number.isFinite(meanAbs) ? Math.round(meanAbs * 1000) : undefined,
      meanSignedOffsetMs: Number.isFinite(meanSigned) ? Math.round(meanSigned * 1000) : undefined,
    })
  }

  private hud() {
    this.d.setHud({
      progress: this.judged / this.total,
      progressText: `${this.judged}/${this.total}`,
      stats: [
        { label: 'pontos', value: String(this.score) },
        { label: 'combo', value: `${this.combo} ×${multiplierFor(this.combo)}` },
        { label: 'acerto', value: percent(this.hits, this.judged) },
      ],
    })
  }

  dispose() {
    super.dispose()
    this.metronome.dispose()
  }
}
