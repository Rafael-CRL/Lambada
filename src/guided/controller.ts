import { audioContext } from '../audio/clock'
import { Metronome } from '../audio/metronome'
import type { Microphone } from '../audio/microphone'
import { scheduleNote } from '../audio/synth'
import { DETECTION } from '../config'
import { defaultSpelling, midiOf, namePtOctave, parseNote } from '../domain/notes'
import { displayPosition } from '../domain/scales'
import type { StudySession } from '../engine/session'
import type { Feedback, FretFeedback } from '../exercises/controller'
import { ExerciseClock, FrameLoop } from '../exercises/stage'
import { timeline, type Study, type TimelineNote } from './catalog'
import { GuidedJudge } from './judge'
import type { StudyOptions } from './progress'

export interface GuidedView {
  bar: number
  visit: number
  beat: number
  progress: number
  countdown: number | null
  attempts: number
  correct: number
  feedback: Feedback | null
  fret: FretFeedback | null
  marks: Record<string, 'ok' | 'err' | 'oct'>
  done: boolean
}
export const EMPTY_VIEW: GuidedView = { bar: 0, visit: 0, beat: 0, progress: 0, countdown: null, attempts: 0, correct: 0, feedback: null, fret: null, marks: {}, done: false }

/** Partitura fixa: mesmo relógio, microfone e metrônomo das outras atividades. */
export class GuidedController {
  private clock = new ExerciseClock()
  private loop = new FrameLoop(() => this.update())
  private metro: Metronome | null = null
  private base = 0
  private cursor = 0
  private scheduled = 0
  private sounds: { end: number; stop: () => void }[] = []
  private done = false
  private started = false
  private lastView = -Infinity
  private feedbackKey = 0
  private feedback: Feedback | null = null
  private fret: FretFeedback | null = null
  readonly notes: TimelineNote[]
  readonly judge: GuidedJudge
  readonly totalBeats: number
  private readyAt = 0

  constructor(private d: {
    study: Study; options: StudyOptions; mic: Microphone | null; session: StudySession | null;
    toleranceMs: number; onView: (view: GuidedView) => void; onFinish: () => void;
  }) {
    const score = timeline(d.study)
    const length = d.study.order.length * d.study.meter
    this.totalBeats = length * d.options.loops
    this.notes = Array.from({ length: d.options.loops }, (_, lap) => score.map((n) => ({ ...n,
      at: n.at + lap * length, end: n.end + lap * length, visit: n.visit + lap * d.study.order.length,
    }))).flat().filter((n) => n.note !== null)
    this.judge = new GuidedJudge(this.notes, d.toleranceMs / 1000)
  }
  private get free() { return this.d.options.mode === 'mic' && this.d.options.tempo === 'free' }
  private get spb() { return 60 / this.d.options.bpm }
  private timeOf = (n: TimelineNote) => this.base + n.at * this.spb
  get paused() { return this.clock.paused }

  start() {
    if (this.started) return
    this.started = true
    const count = this.d.study.unmetered ? 4 : this.d.study.meter
    this.base = this.clock.now() + (this.free ? 0 : count * this.spb + 0.15)
    this.readyAt = this.base
    if (!this.free) {
      this.metro = new Metronome(this.d.options.bpm, this.d.study.unmetered ? 1 : this.d.study.meter)
      this.metro.start(this.clock.toApp(this.base), -count, this.totalBeats - 1)
    }
    this.update()
    this.loop.start()
  }
  pause() {
    this.clock.pause()
    this.metro?.stop()
    this.stopSounds()
    // sons agendados no lookahead precisam voltar ao retomar
    this.scheduled = this.notes.findIndex((n) => this.timeOf(n) > this.clock.now())
    if (this.scheduled < 0) this.scheduled = this.notes.length
  }
  resume() {
    if (this.done) return
    this.clock.resume()
    this.metro?.start(this.clock.toApp(this.base), Math.ceil((this.clock.now() - this.base) / this.spb), this.totalBeats - 1)
  }
  private stopSounds() { this.sounds.forEach((s) => s.stop()); this.sounds = [] }

  update() {
    if (!this.started || this.done) return
    const now = this.clock.now()
    // Mesmo em pausa, esvazia eventos; uma nota tocada no intervalo não vira resposta.
    const index = this.free ? this.judge.next : this.nextTimed(now)
    const target = this.notes[index]
    const events = this.d.mic?.poll(target ? midiOf(parseNote(target.note!)) - 12 : null) ?? []
    if (this.paused) return
    for (const event of events) {
      if (event.type !== 'note') continue
      const time = this.clock.fromApp(event.onsetTime)
      if (time < this.base) continue
      const answer = this.judge.answer(event.midi, time, this.free, this.timeOf)
      if (!answer) continue
      const note = this.notes[answer.index]
      if (answer.first) this.d.session?.record(note.note!, answer.result, this.free ? Math.max(0, time - this.readyAt) : this.spb)
      if (answer.result === 'correct') {
        this.readyAt = now
        this.feedback = { kind: 'ok', text: 'certo', key: ++this.feedbackKey }
        this.fret = null
      } else {
        const expected = namePtOctave(parseNote(note.note!))
        const heard = namePtOctave(defaultSpelling(event.midi + 12))
        this.feedback = { kind: answer.result === 'wrong-octave' ? 'oct' : 'err', text: answer.result === 'wrong-octave' ? 'oitava errada' : `toque ${expected}`, detail: `ouvi ${heard}`, key: ++this.feedbackKey }
        const position = note.position ?? displayPosition('solta', midiOf(parseNote(note.note!)) - 12, true)
        if (position) this.fret = { target: position, played: displayPosition('solta', event.midi, true), targetName: expected, playedName: heard }
      }
    }
    if (!this.free && this.d.options.mode === 'mic') {
      const grace = DETECTION.attackIgnore + DETECTION.stableTime + 0.12
      this.notes.forEach((n, i) => {
        if (now > this.timeOf(n) + this.judge.tolerance + grace && this.judge.miss(i)) {
          this.d.session?.record(n.note!, 'wrong', this.spb)
          this.feedback = { kind: 'err', text: 'passou', detail: namePtOctave(parseNote(n.note!)), key: ++this.feedbackKey }
        }
      })
    }
    if (this.d.options.mode === 'listen') this.schedule()
    const beat = this.free ? (this.notes[this.judge.next]?.at ?? this.totalBeats) : Math.max(0, (now - this.base) / this.spb)
    this.cursor = beat
    const last = this.notes[this.notes.length - 1]
    const grace = DETECTION.attackIgnore + DETECTION.stableTime + 0.12
    const endTime = Math.max(this.base + this.totalBeats * this.spb,
      this.d.options.mode === 'mic' && last ? this.timeOf(last) + this.judge.tolerance + grace + 0.001 : -Infinity)
    const ended = this.free ? this.judge.next < 0 : now >= endTime
    if (now - this.lastView >= 0.04 || ended) {
      this.lastView = now
      const visit = Math.min(this.d.study.order.length * this.d.options.loops - 1, Math.floor(beat / this.d.study.meter))
      const marks: GuidedView['marks'] = {}
      for (const [i, result] of this.judge.results) if (this.notes[i].visit === visit) marks[this.notes[i].key] = result === 'correct' ? 'ok' : result === 'wrong-octave' ? 'oct' : 'err'
      this.d.onView({ bar: this.d.study.order[visit % this.d.study.order.length], visit, beat: beat % this.d.study.meter,
        progress: ended ? 1 : this.free ? this.judge.resolved.size / this.notes.length : beat / this.totalBeats,
        countdown: !this.free && now < this.base ? Math.ceil((this.base - now) / this.spb) : null,
        attempts: this.judge.attempts, correct: this.judge.correct, feedback: this.feedback, fret: this.fret, marks, done: ended,
      })
    }
    if (ended) { this.done = true; this.loop.stop(); this.metro?.stop(); this.stopSounds(); this.d.onFinish() }
  }
  private nextTimed(now: number) {
    let index = -1
    this.notes.forEach((n, i) => {
      if (this.judge.resolved.has(i)) return
      if (index < 0 || Math.abs(this.timeOf(n) - now) < Math.abs(this.timeOf(this.notes[index]) - now)) index = i
    })
    return index
  }
  private schedule() {
    const ctx = audioContext()
    this.sounds = this.sounds.filter((s) => s.end > ctx.currentTime)
    while (this.scheduled < this.notes.length) {
      const n = this.notes[this.scheduled]
      const at = this.clock.toApp(this.timeOf(n))
      if (at > ctx.currentTime + 0.15) break
      if (at >= ctx.currentTime - 0.04) {
        const duration = (n.end - n.at) * this.spb
        this.sounds.push({ end: at + duration, stop: scheduleNote(midiOf(parseNote(n.note!)) - 12, Math.max(ctx.currentTime, at), duration, 'guitar', 0.55) })
      }
      this.scheduled++
    }
  }
  get beat() { return this.cursor }
  dispose() { this.done = true; this.loop.stop(); this.metro?.dispose(); this.stopSounds() }
}
