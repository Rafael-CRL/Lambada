import type { Microphone } from '../audio/microphone'
import { playNote } from '../audio/synth'
import { LESSON, READING } from '../config'
import { defaultSpelling, matchPitch, midiOf, namePt, namePtOctave, noteId, spellingId, writtenFromSounding, type Note } from '../domain/notes'
import { displayPosition, positionOfMidiInScale } from '../domain/scales'
import { staffStep } from '../domain/staff'
import type { AttemptResult } from '../engine/adaptive'
import { octaveHint, percent, pressedSoundingMidi, type Feedback, type FretFeedback, type Hud, type Spelling } from '../exercises/controller'
import { ExerciseClock, FrameLoop, type StaffGuide, type StaffStage, type StageNote } from '../exercises/stage'
import type { Timbre } from '../exercises/types'
import { barlineShapes, S } from '../staff/geometry'
import { lessonSteps, mixSteps, placeName, type LessonCard, type LessonResult, type LessonStep, type NotesLesson } from './lessons'
import { TipTrigger, TIPS, tipFor, type TipId } from './tips'

export interface LessonDeps {
  lesson: NotesLesson
  stage: Pick<StaffStage, 'width' | 'hitNoteX' | 'addNote' | 'addShapes'>
  guide: Pick<StaffGuide, 'show'> | null
  /** lido a cada resposta (o som muda sem reiniciar) */
  timbre: () => Timbre
  setHud: (patch: Partial<Hud>) => void
  /** cartão entre as partes (null = some) */
  setCard: (card: LessonCard | null) => void
  finish: (r: LessonResult) => void
  /** violão: o microfone responde */
  mic?: Pick<Microphone, 'poll'> | null
  /** violão: onde fica a nota no braço (null = some) */
  setFret?: (f: FretFeedback | null) => void
  /** dica quando o aluno erra muito (null = some) */
  setTip?: (text: string | null) => void
  rng?: () => number
}

interface Slot extends LessonStep {
  sn?: StageNote
  x: number
  spawned: boolean
  gone: boolean
  /** o cartão desta nota já foi mostrado */
  carded?: boolean
  /** o aluno pediu a cola: não conta, e no sorteio volta depois */
  helped?: boolean
  /** barra de compasso antes da nota */
  bar?: StageNote
}

/**
 * Uma lição de notas: semibreves em fila, sem compasso. A nota na linha
 * espera a resposta (botão ou o violão); errou, mostra a certa
 * (nome e lugar), espera um pouco e segue. No sorteio, a nota errada volta
 * algumas notas depois, com a cola acesa só para ela. Entre as partes, um
 * cartão espera qualquer tecla. Errando muito, uma dica lembra a regra.
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
  private paused = false
  private readonly gap = LESSON.gap * S
  private readonly mic: boolean
  private tips = new TipTrigger()
  private lastTip: TipId | null = null
  /** respostas até a dica sumir */
  private tipLeft = 0
  /** a lição já apresentou o Dó do 3º espaço (2ª referência) */
  private readonly knowsDo: boolean
  /** notas que ainda recebem a cola fraca depois de um erro */
  private support = 0
  /** a cola pode ajudar (fora do Desafio e das lições sem cola) */
  readonly guided: boolean

  constructor(private d: LessonDeps) {
    this.mic = d.lesson.body.input === 'mic'
    this.slots = lessonSteps(d.lesson, d.rng).map((s) => ({ ...s, x: Infinity, spawned: false, gone: false }))
    this.knowsDo = this.slots.some((s) => noteId(s.note) === 'C5')
    this.guided = !d.lesson.challenge && !d.lesson.body.noGuide
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

  /** "?" aberto: a lição espera (não aceita respostas nem conta o tempo). */
  pause() {
    this.paused = true
  }

  resume() {
    if (!this.paused) return
    this.paused = false
    this.readyAt = this.clock.now()
  }

  /** Pode responder agora? Com o cartão aberto, a resposta só fecha o cartão. */
  private ready(): Slot | null {
    if (!this.started || this.finished || this.paused || this.holdUntil !== null) return null
    if (this.card) {
      this.dismissCard()
      return null
    }
    const s = this.current
    return s?.spawned ? s : null
  }

  /** Botão de nota (nome). */
  answerButton(spelling: Spelling, perfTime: number): AttemptResult | null {
    const s = this.ready()
    if (!s) return null
    const timbre = this.d.timbre()
    if (timbre !== 'off') playNote(pressedSoundingMidi(spelling, s.note), timbre)
    const result = this.judge(s, spellingId(spelling) === spellingId(s.note) ? 'correct' : 'wrong', this.clock.now(perfTime))
    this.tip(s, spelling, result === 'correct')
    return result
  }

  /** Dica depois de muitos erros (só nos botões, fora do Desafio e da apresentação). */
  private tip(s: Slot, answer: Spelling, ok: boolean) {
    if (!this.d.setTip || s.name || s.helped || this.d.lesson.challenge) return
    if (this.tipLeft > 0 && --this.tipLeft === 0) this.d.setTip(null)
    if (!this.tips.push(ok)) return
    this.lastTip = tipFor(s.note, answer, this.knowsDo, this.lastTip)
    this.tipLeft = LESSON.tipLasts
    this.d.setTip(TIPS[this.lastTip])
  }

  /** Nota tocada no violão (MIDI escrito). */
  private answerMic(writtenMidi: number, time: number) {
    const s = this.ready()
    if (!s) return
    const result = matchPitch(s.note, writtenMidi)
    this.judge(s, result, time, writtenMidi)
  }

  private judge(s: Slot, result: AttemptResult, now: number, playedWrittenMidi?: number): AttemptResult {
    const ok = result === 'correct'
    if (s.timed) this.times.push(Math.max(0, now - this.readyAt))
    if (!s.name && !s.helped) {
      this.attempts++
      if (ok) this.correct++
    }
    if (ok) {
      if (s.helped && s.part === 'mix') this.retry(s)
      s.sn?.setState('ok')
      this.feedback('ok', '')
      this.d.setFret?.(null)
      this.advance(now)
    } else {
      const step = staffStep(s.note)
      const label = namePt(s.note)
      s.sn?.setState(result === 'wrong-octave' ? 'oct' : 'err')
      s.sn?.setLabel(label, 1)
      this.d.guide?.show(s.guide, step)
      if (playedWrittenMidi !== undefined) this.micMistake(s, playedWrittenMidi, result)
      else this.feedback('err', label, placeName(step))
      if (s.part === 'mix') this.retry(s)
      if (this.guided) this.support = LESSON.supportNotes
      this.holdUntil = now + (this.mic ? LESSON.revealTimeMic : LESSON.revealTime)
    }
    this.hud()
    return result
  }

  /** Violão: o que foi ouvido e onde fica a nota certa. */
  private micMistake(s: Slot, writtenMidi: number, result: AttemptResult) {
    const heard = namePtOctave(writtenFromSounding(defaultSpelling(writtenMidi - 12)))
    this.showFret(s.note, writtenMidi)
    if (result === 'wrong-octave') this.feedback('oct', 'nota certa, oitava errada', `ouvi ${heard} · ${octaveHint(midiOf(s.note), writtenMidi)}`)
    else this.feedback('err', namePtOctave(s.note), `ouvi ${heard}`)
  }

  private showFret(target: Note, playedWrittenMidi?: number) {
    if (!this.d.setFret) return
    const pos = positionOfMidiInScale('solta', midiOf(target) - 12, true)
    if (!pos) return
    this.d.setFret({
      target: pos,
      played: playedWrittenMidi === undefined ? null : displayPosition('solta', playedWrittenMidi - 12, true),
      targetName: namePtOctave(target),
      playedName: playedWrittenMidi === undefined ? null : namePtOctave(writtenFromSounding(defaultSpelling(playedWrittenMidi - 12))),
    })
  }

  /** A nota errada volta `retryAfter` notas depois, sem vizinha igual. */
  private retry(s: Slot) {
    let at = Math.min(this.head + 1 + LESSON.retryAfter, this.slots.length)
    const same = (i: number) => this.slots[i] && noteId(this.slots[i].note) === noteId(s.note)
    while (at <= this.slots.length && (same(at - 1) || same(at))) at++
    at = Math.min(at, this.slots.length)
    this.slots.splice(at, 0, { note: s.note, natural: s.natural, part: 'mix', name: false, guide: 0, cue: true, timed: s.timed, x: Infinity, spawned: false, gone: false })
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
    this.d.setFret?.(null)
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
    // depois de um erro, a cola volta fraca e apaga nota a nota
    const support = this.support > 0 ? (LESSON.supportGuide * this.support--) / LESSON.supportNotes : 0
    this.d.guide?.show(Math.max(s.guide, support), s.name || s.cue ? staffStep(s.note) : null)
    // violão: na apresentação e na volta de um erro, o braço mostra onde fica
    if (this.mic && (s.part === 'intro' || s.cue)) this.showFret(s.note)
    if (s.isNew) this.feedback('info', namePt(s.note), placeName(staffStep(s.note)))
  }

  /** "Ver a cola": acende a cola inteira para a nota da vez. Ela não conta e, no sorteio, volta depois. */
  help() {
    const s = this.ready()
    if (!s || !this.guided || s.name) return
    s.helped = true
    this.d.guide?.show(1, null)
  }

  /** Fecha o cartão e segue a lição (qualquer tecla, clique ou nota). */
  dismissCard() {
    if (!this.card) return
    this.card = null
    this.d.setCard(null)
    this.arrive()
  }

  /** "Treinar mais": mais notas sorteadas, sem ajuda, na mesma lição. */
  more(count: number = LESSON.moreNotes) {
    if (!this.finished || this.head < this.slots.length) return
    const before = this.slots.map((s) => noteId(s.note))
    for (const step of mixSteps(this.d.lesson, count, this.d.rng, before)) this.slots.push({ ...step, x: Infinity, spawned: false, gone: false })
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
    if (this.d.mic) {
      const events = this.d.mic.poll()
      if (!this.finished && !this.paused) for (const e of events) if (e.type === 'note') this.answerMic(e.midi + 12, this.clock.fromApp(e.onsetTime))
    }
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
      e.bar?.setX(e.x - this.gap / 2)
      if (e.x < -3 * S) {
        e.sn?.remove()
        e.bar?.remove()
        e.gone = true
      }
    }
    if (this.endAt !== null && now >= this.endAt) this.end()
  }

  private spawn(e: Slot, x: number) {
    e.spawned = true
    e.x = x
    const label = e.name ? { text: namePt(e.note), opacity: 1 } : undefined
    // o acidente que vem de antes no compasso não é desenhado de novo
    e.sn = this.d.stage.addNote(e.shown ?? e.note, x, label, { figure: 'whole', natural: e.natural })
    if (e.cue) e.sn.g.classList.add('is-retry')
    // a barra fecha o compasso: um acidente não passa dela
    if (e.barStart || (this.d.lesson.body.barEach && e !== this.slots[0])) e.bar = this.d.stage.addShapes(barlineShapes(), x - this.gap / 2, 'is-bar')
  }

  private end() {
    this.finished = true
    this.loop.stop()
    this.d.setFret?.(null)
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
