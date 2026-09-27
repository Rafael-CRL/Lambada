import type { Microphone } from '../audio/microphone'
import { playNote } from '../audio/synth'
import type { TrackerEvent } from '../audio/tracker'
import type { SessionRecord, Settings } from '../db/db'
import type { Position } from '../domain/fretboard'
import {
  defaultSpelling,
  matchButton,
  matchPitch,
  midiOf,
  namePt,
  namePtOctave,
  writtenFromSounding,
  type Note,
} from '../domain/notes'
import { displayPosition, type StudyItem } from '../domain/scales'
import type { AttemptResult } from '../engine/adaptive'
import type { StudySession } from '../engine/session'
import { ExerciseClock, FrameLoop, type StaffStage, type StageNote } from './stage'
import type { ExerciseConfig } from './types'

export interface Feedback {
  kind: 'ok' | 'err' | 'oct' | 'info'
  text: string
  detail?: string
  /** muda a cada feedback para reanimar */
  key: number
}

export interface FretFeedback {
  target: Position
  played: Position | null
  targetName: string
  playedName: string | null
}

export interface Hud {
  /** null = sem barra (sessão sem fim) */
  progress: number | null
  progressText: string
  feedback: Feedback | null
  stats: { label: string; value: string }[]
  toast: string | null
  countdown: string | null
  fret: FretFeedback | null
}

export const EMPTY_HUD: Hud = {
  progress: 0,
  progressText: '',
  feedback: null,
  stats: [],
  toast: null,
  countdown: null,
  fret: null,
}

export interface ControllerDeps {
  config: ExerciseConfig
  settings: Settings
  session: StudySession
  mic: Microphone | null
  stage: StaffStage
  setHud: (patch: Partial<Hud>) => void
  finish: (extra?: Partial<SessionRecord>) => void
}

export type Spelling = Pick<Note, 'letter' | 'acc'>

/** Resposta normalizada: botão (grafia) ou microfone (MIDI escrito). */
export type Answer = { kind: 'button'; spelling: Spelling; time: number } | { kind: 'mic'; writtenMidi: number; time: number }

export function judge(expected: StudyItem, a: Answer): AttemptResult {
  if (a.kind === 'button') return matchButton(expected.written, a.spelling) ? 'correct' : 'wrong'
  return matchPitch(expected.written, a.writtenMidi)
}

export abstract class Controller {
  protected clock = new ExerciseClock()
  private loop = new FrameLoop((t) => this.frame(t))
  private lastFrame: number | null = null
  private feedbackKey = 0
  private toastTimer: number | null = null
  protected finished = false
  protected started = false

  constructor(protected d: ControllerDeps) {}

  start() {
    this.started = true
    this.begin(this.clock.now())
    this.loop.start()
  }

  protected abstract begin(now: number): void
  protected abstract update(now: number, dt: number): void
  /** Resposta do usuário; devolve o julgamento (para o botão piscar) ou null se ignorada. */
  protected abstract answer(a: Answer): AttemptResult | null

  /** Nota esperada agora (para dar o som do botão na oitava certa). */
  protected target(): StudyItem | null {
    return null
  }

  answerButton(spelling: Spelling, perfTime: number): AttemptResult | null {
    if (!this.started || this.clock.paused || this.finished) return null
    const target = this.target()
    const result = this.answer({ kind: 'button', spelling, time: this.clock.now(perfTime) })
    const timbre = this.d.config.timbre
    if (timbre !== 'off') playNote(pressedSoundingMidi(spelling, target?.written ?? null), timbre)
    return result
  }

  /** Erro pelo microfone: mostra o que foi ouvido e onde fica a nota certa. */
  protected micMistake(item: StudyItem, writtenMidi: number, result: AttemptResult, sn?: StageNote) {
    sn?.showGhost(defaultSpelling(writtenMidi))
    const heard = namePtOctave(writtenFromSounding(defaultSpelling(writtenMidi - 12)))
    const s = this.d.session
    this.d.setHud({
      fret: {
        target: item.position,
        played: displayPosition(s.scale, writtenMidi - 12, s.accidentals),
        targetName: namePtOctave(item.written),
        playedName: heard,
      },
    })
    if (result === 'wrong-octave')
      this.feedback('oct', 'nota certa, oitava errada', `ouvi ${heard} · ${octaveHint(midiOf(item.written), writtenMidi)}`)
    else this.feedback('err', namePtOctave(item.written), `ouvi ${heard}`)
  }

  private frame(perf: number) {
    const now = this.clock.now(perf)
    const dt = this.lastFrame === null ? 0 : Math.min(0.1, Math.max(0, now - this.lastFrame))
    this.lastFrame = now
    if (this.d.mic) {
      const events = this.d.mic.poll()
      if (!this.clock.paused && !this.finished) for (const e of events) this.onMic(e)
    }
    if (!this.clock.paused && !this.finished) this.update(now, dt)
  }

  protected onMic(e: TrackerEvent) {
    if (e.type !== 'note') return
    this.answer({ kind: 'mic', writtenMidi: e.midi + 12, time: this.clock.fromApp(e.onsetTime) })
  }

  pause() {
    if (this.finished) return
    this.clock.pause()
    this.onPause()
  }

  resume() {
    this.clock.resume()
    this.lastFrame = null
    this.onResume()
  }

  protected onPause() {}
  protected onResume() {}

  get paused() {
    return this.clock.paused
  }

  protected feedback(kind: Feedback['kind'], text: string, detail?: string) {
    this.d.setHud({ feedback: { kind, text, detail, key: ++this.feedbackKey } })
  }

  protected announceUnlocks(items: StudyItem[]) {
    if (!items.length) return
    this.d.setHud({ toast: `nova nota: ${items.map((i) => namePt(i.written)).join(', ')}` })
    if (this.toastTimer) window.clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => this.d.setHud({ toast: null }), 2600)
  }

  protected complete(extra?: Partial<SessionRecord>) {
    if (this.finished) return
    this.finished = true
    this.loop.stop()
    this.d.finish(extra)
  }

  dispose() {
    this.finished = true
    this.loop.stop()
    if (this.toastTimer) window.clearTimeout(this.toastTimer)
  }
}

export function percent(correct: number, total: number): string {
  return total ? `${Math.round((correct / total) * 100)}%` : '—'
}

export function seconds(s: number): string {
  return Number.isFinite(s) ? `${s.toFixed(2)} s` : '—'
}

/** Dica para "oitava errada": em que direção corrigir. */
export function octaveHint(expectedWrittenMidi: number, playedWrittenMidi: number): string {
  const diff = Math.round((expectedWrittenMidi - playedWrittenMidi) / 12)
  const n = Math.abs(diff)
  const oct = n === 1 ? 'uma oitava' : `${n} oitavas`
  return diff > 0 ? `toque ${oct} acima` : `toque ${oct} abaixo`
}

/**
 * MIDI soando do botão apertado: a grafia na oitava mais próxima da nota
 * esperada (acerto soa exatamente a nota da pauta).
 */
export function pressedSoundingMidi(spelling: Spelling, target: Note | null): number {
  const ref = target ? midiOf(target) : 72
  const base = midiOf({ ...spelling, octave: 4 })
  let best = base
  for (let o = -3; o <= 3; o++) {
    const m = base + 12 * o
    if (Math.abs(m - ref) < Math.abs(best - ref)) best = m
  }
  return best - 12
}
