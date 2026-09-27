import { playNote } from '../audio/synth'
import { LESSON, READING } from '../config'
import { matchButton, namePt, noteId, type Note } from '../domain/notes'
import { staffStep } from '../domain/staff'
import type { AttemptResult } from '../engine/adaptive'
import { percent, pressedSoundingMidi, type Feedback, type Hud, type Spelling } from '../exercises/controller'
import { ExerciseClock, FrameLoop, type StaffGuide, type StaffStage, type StageNote } from '../exercises/stage'
import type { Timbre } from '../exercises/types'
import { S } from '../staff/geometry'
import { lessonSteps, mixSteps, placeName, type LessonCard, type LessonDef, type LessonResult, type LessonStep } from './lessons'

export interface LessonDeps {
  lesson: LessonDef
  stage: Pick<StaffStage, 'width' | 'hitNoteX' | 'addNote'>
  guide: Pick<StaffGuide, 'show'> | null
  /** lido a cada resposta (o som muda sem reiniciar) */
  timbre: () => Timbre
  setHud: (patch: Partial<Hud>) => void
  /** cartão entre as partes (null = some) */
  setCard: (card: LessonCard | null) => void
  finish: (r: LessonResult) => void
  rng?: () => number
}

interface Slot extends LessonStep {
  sn?: StageNote
  x: number
  spawned: boolean
  gone: boolean
  /** o cartão desta nota já foi mostrado */
  carded?: boolean
}

/**
 * Uma lição da trilha: semibreves em fila, sem compasso. A nota na linha
 * espera a resposta; errou, mostra a certa (nome e lugar), espera um pouco e
 * segue. No sorteio, a nota errada volta algumas notas depois, com a cola
 * acesa só para ela. Entre as partes, um cartão espera qualquer tecla.
 */
export class LessonController {
  private clock = new ExerciseClock()
  private loop = new FrameLoop((t) => this.frame(t))
  private lastFrame: number | null = null
  private slots: Slot[]
  private head = 0
  /** depois de um erro: a resposta certa fica à vista até aqui */
  private holdUntil: number | null = null
  private endAt: number | null = null
  private card: LessonCard | null = null
  /** quando a nota da vez ficou pronta para responder (depois do cartão) */
  private readyAt = 0
  private attempts = 0
  private correct = 0
  /** tempos de resposta das notas com tempo (Desafio) */
  private times: number[] = []
  private feedbackKey = 0
  private started = false
  private finished = false
  private readonly gap = LESSON.gap * S

  constructor(private d: LessonDeps) {
    this.slots = lessonSteps(d.lesson, d.rng).map((s) => ({ ...s, x: Infinity, spawned: false, gone: false }))
  }

  start() {
    this.started = true
    // as primeiras já no lugar, sem entrar deslizando
    this.update(this.clock.now(), 0, true)
    this.arrive()
    this.hud()
    this.loop.start()
  }

  /** Notas respondidas (para decidir o que fazer ao sair). */
  get answered(): number {
    return this.head
  }

  get total(): number {
    return this.slots.length
  }

  private get current(): Slot | undefined {
    return this.slots[this.head]
  }

  /** Nota esperada agora. */
  get target(): Note | null {
    return this.current?.note ?? null
  }

  answerButton(spelling: Spelling, perfTime: number): AttemptResult | null {
    if (!this.started || this.finished || this.holdUntil !== null) return null
    // com o cartão aberto, a tecla só fecha o cartão
    if (this.card) {
      this.dismissCard()
      return null
    }
    const s = this.current
    if (!s?.spawned) return null
    const now = this.clock.now(perfTime)
    if (s.timed) this.times.push(Math.max(0, now - this.readyAt))
    const timbre = this.d.timbre()
    if (timbre !== 'off') playNote(pressedSoundingMidi(spelling, s.note), timbre)
    const ok = matchButton(s.note, spelling)
    if (!s.name) {
      this.attempts++
      if (ok) this.correct++
    }
    if (ok) {
      s.sn?.setState('ok')
      this.feedback('ok', '')
      this.advance(now)
    } else {
      const step = staffStep(s.note)
      s.sn?.setState('err')
      s.sn?.setLabel(namePt(s.note), 1)
      this.d.guide?.show(s.guide, step)
      this.feedback('err', namePt(s.note), placeName(step))
      if (s.part === 'mix') this.retry(s)
      this.holdUntil = now + LESSON.revealTime
    }
    this.hud()
    return ok ? 'correct' : 'wrong'
  }

  /** A nota errada volta `retryAfter` notas depois, sem vizinha igual. */
  private retry(s: Slot) {
    let at = Math.min(this.head + 1 + LESSON.retryAfter, this.slots.length)
    const same = (i: number) => this.slots[i] && noteId(this.slots[i].note) === noteId(s.note)
    while (at <= this.slots.length && (same(at - 1) || same(at))) at++
    at = Math.min(at, this.slots.length)
    this.slots.splice(at, 0, { note: s.note, part: 'mix', name: false, guide: 0, cue: true, timed: s.timed, x: Infinity, spawned: false, gone: false })
  }

  private advance(now: number) {
    this.holdUntil = null
    this.head++
    this.arrive()
    if (this.head >= this.slots.length) this.endAt = now + 0.6
  }

  /** A nota chegou na linha: primeiro o cartão (se houver), depois as ajudas dela. */
  private arrive() {
    const s = this.current
    if (!s) return this.d.guide?.show(0, null)
    if (s.card && !s.carded) {
      s.carded = true
      this.card = s.card
      this.d.guide?.show(0, null)
      this.feedback('ok', '')
      this.d.setCard(s.card)
      return
    }
    this.readyAt = this.clock.now()
    this.d.guide?.show(s.guide, s.name || s.cue ? staffStep(s.note) : null)
    if (s.isNew) this.feedback('info', namePt(s.note), placeName(staffStep(s.note)))
  }

  /** Fecha o cartão e segue a lição (qualquer tecla, clique ou nota). */
  dismissCard() {
    if (!this.card) return
    this.card = null
    this.d.setCard(null)
    this.arrive()
  }

  /** "Treinar mais": mais notas sorteadas, sem ajuda, na mesma lição. */
  more(count = LESSON.moreNotes) {
    if (!this.finished || this.head < this.slots.length) return
    const before = this.slots.map((s) => noteId(s.note))
    for (const step of mixSteps(this.d.lesson, count, this.d.rng, before))
      this.slots.push({ ...step, x: Infinity, spawned: false, gone: false })
    this.finished = false
    this.endAt = null
    this.lastFrame = null
    this.arrive()
    this.hud()
    this.loop.start()
  }

  private frame(perf: number) {
    const now = this.clock.now(perf)
    const dt = this.lastFrame === null ? 0 : Math.min(0.1, Math.max(0, now - this.lastFrame))
    this.lastFrame = now
    if (!this.finished) this.update(now, dt)
  }

  update(now: number, dt: number, instant = false) {
    if (this.holdUntil !== null && now >= this.holdUntil) this.advance(now)
    const stage = this.d.stage
    const step = READING.waitSpeed * S * dt
    for (let i = 0; i < this.slots.length; i++) {
      const e = this.slots[i]
      if (e.gone) continue
      const target = stage.hitNoteX + (i - this.head) * this.gap
      if (!e.spawned) {
        // a nota que volta surge no lugar dela; as outras entram pela direita
        if (target < stage.width + 2 * S) this.spawn(e, instant || e.cue ? target : Math.max(target, stage.width + S))
        continue
      }
      // anda até o alvo nos dois sentidos (uma nota que volta abre espaço na fila)
      e.x += Math.max(-step, Math.min(step, target - e.x))
      e.sn?.setX(e.x)
      if (e.x < -3 * S) {
        e.sn?.remove()
        e.gone = true
      }
    }
    if (this.endAt !== null && now >= this.endAt) this.end()
  }

  private spawn(e: Slot, x: number) {
    e.spawned = true
    e.x = x
    e.sn = this.d.stage.addNote(e.note, x, e.name ? { text: namePt(e.note), opacity: 1 } : undefined, { figure: 'whole' })
    if (e.cue) e.sn.g.classList.add('is-retry')
  }

  private end() {
    this.finished = true
    this.loop.stop()
    const meanTime = this.times.length ? this.times.reduce((a, b) => a + b, 0) / this.times.length : undefined
    this.d.finish({ correct: this.correct, attempts: this.attempts, meanTime })
  }

  private feedback(kind: Feedback['kind'], text: string, detail?: string) {
    this.d.setHud({ feedback: { kind, text, detail, key: ++this.feedbackKey } })
  }

  private hud() {
    const done = Math.min(this.head, this.slots.length)
    this.d.setHud({
      progress: done / this.slots.length,
      progressText: `${done}/${this.slots.length}`,
      stats: [{ label: 'acerto', value: percent(this.correct, this.attempts) }],
    })
  }

  dispose() {
    this.finished = true
    this.loop.stop()
  }
}
