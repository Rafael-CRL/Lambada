import { READING } from '../config'
import { defaultSpelling, midiOf, namePt, namePtOctave, writtenFromSounding } from '../domain/notes'
import { displayPosition, scaleSequence, type StudyItem } from '../domain/scales'
import type { AttemptResult } from '../engine/adaptive'
import { S } from '../staff/geometry'
import { Controller, judge, octaveHint, percent, type Answer, type ControllerDeps } from './controller'
import type { StageNote } from './stage'
import type { GuitarDrill } from './types'

const PREVIEW = 3

/**
 * Pauta → violão: a pauta mostra a nota, o usuário toca, o microfone valida.
 * Repetição (N toques certos por nota), Escala (sobe e desce) ou Adaptativo.
 */
export class GuitarController extends Controller {
  private queue: StudyItem[] = []
  private shown: { item: StudyItem; sn: StageNote }[] = []
  private readonly total: number
  private done = 0
  private reps = 0
  private since = 0
  private correct = 0
  private attempts = 0
  private revertAt: number | null = null
  private endAt: number | null = null
  private readonly gap = READING.conveyorGap * S

  constructor(
    d: ControllerDeps,
    private drill: GuitarDrill,
  ) {
    super(d)
    const s = d.session
    if (drill === 'scale') this.queue = scaleSequence(s.items)
    else if (drill === 'repeat') this.queue = [...s.active].sort((a, b) => a.midi - b.midi || b.written.acc - a.written.acc)
    this.total = drill === 'adaptive' ? d.settings.sessionLength : this.queue.length
  }

  private get repsNeeded() {
    return this.drill === 'repeat' ? this.d.settings.repetitions : 1
  }

  private get x0() {
    return this.d.stage.hitNoteX
  }

  private produced = 0
  private nextItem(): StudyItem | null {
    if (this.produced >= this.total) return null
    this.produced++
    if (this.drill === 'adaptive') return this.d.session.next()
    const item = this.queue[this.produced - 1]
    this.d.session.presented(item.id)
    return item
  }

  private fillPreview() {
    while (this.shown.length < PREVIEW + 1) {
      const item = this.nextItem()
      if (!item) break
      const last = this.shown[this.shown.length - 1]
      const x = last ? Math.max(last.sn.x + this.gap, this.d.stage.width + S) : this.x0
      const opacity = this.d.session.labelOpacity(item.id)
      const sn = this.d.stage.addNote(item.written, x, { text: opacity > 0 ? namePt(item.written) : '', opacity })
      this.shown.push({ item, sn })
    }
    this.shown.forEach((s, i) => s.sn.setState(i === 0 ? null : 'muted'))
  }

  protected begin(now: number) {
    this.fillPreview()
    this.since = now
    this.hud()
  }

  protected update(now: number, dt: number) {
    const step = READING.waitSpeed * S * dt
    this.shown.forEach((s, i) => s.sn.setX(Math.max(this.x0 + i * this.gap, s.sn.x - step)))
    if (this.revertAt !== null && now >= this.revertAt) {
      this.revertAt = null
      const cur = this.shown[0]
      if (cur) {
        cur.sn.setState(null)
        const o = this.d.session.labelOpacity(cur.item.id)
        cur.sn.setLabel(o > 0 ? namePt(cur.item.written) : '', o)
      }
    }
    if (this.endAt !== null && now >= this.endAt) this.complete()
  }

  protected answer(a: Answer): AttemptResult | null {
    const cur = this.shown[0]
    if (!cur || a.kind !== 'mic' || this.endAt !== null) return null
    const result = judge(cur.item, a)
    const rt = Math.max(0, a.time - this.since)
    this.since = a.time
    this.attempts++
    this.announceUnlocks(this.d.session.record(cur.item.id, result, rt))

    const playedSounding = a.writtenMidi - 12
    const playedName = namePtOctave(writtenFromSounding(defaultSpelling(playedSounding)))
    if (result === 'correct') {
      this.correct++
      this.reps++
      this.d.setHud({ fret: null })
      this.feedback('ok', namePtOctave(cur.item.written))
      if (this.reps >= this.repsNeeded) this.advance(a.time)
      else {
        cur.sn.setState('ok')
        this.revertAt = a.time + 0.25
      }
    } else {
      const s = this.d.session
      cur.sn.setState(result === 'wrong-octave' ? 'oct' : 'err')
      cur.sn.setLabel(namePt(cur.item.written), 1)
      this.revertAt = a.time + READING.revealTime * 1.5
      this.d.setHud({
        fret: {
          target: cur.item.position,
          played: displayPosition(s.scale, playedSounding, s.accidentals),
          targetName: namePtOctave(cur.item.written),
          playedName,
        },
      })
      if (result === 'wrong-octave') this.feedback('oct', 'nota certa, oitava errada', octaveHint(midiOf(cur.item.written), a.writtenMidi))
      else this.feedback('err', `tocou ${playedName}`, `a nota é ${namePtOctave(cur.item.written)}`)
    }
    this.hud()
    return result
  }

  private advance(time: number) {
    const cur = this.shown.shift()!
    cur.sn.setState('ok')
    cur.sn.fadeOut(0.3)
    this.done++
    this.reps = 0
    this.revertAt = null
    this.fillPreview()
    this.since = time
    if (this.shown.length === 0) this.endAt = time + 0.6
  }

  private hud() {
    const n = this.repsNeeded
    this.d.setHud({
      progress: (this.done + this.reps / n) / Math.max(1, this.total),
      progressText: `${this.done}/${this.total}`,
      reps: this.drill === 'repeat' ? { done: this.reps, total: n } : null,
      stats: [{ label: 'acerto', value: percent(this.correct, this.attempts) }],
    })
  }
}
