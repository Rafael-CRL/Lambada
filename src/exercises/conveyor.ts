import { DETECTION, READING } from '../config'
import { midiOf, namePt } from '../domain/notes'
import type { StudyItem } from '../domain/scales'
import type { AttemptResult } from '../engine/adaptive'
import { NOTEHEAD_W, S } from '../staff/geometry'
import { Controller, judge, octaveHint, percent, type Answer, type ControllerDeps } from './controller'
import type { StageNote } from './stage'
import type { ConveyorFlow } from './types'

interface ConveyorNote {
  item: StudyItem
  sn: StageNote
  resolved: boolean
  /** resultado da primeira resposta (a única registrada no motor) */
  first: AttemptResult | null
  headSince: number | null
  visibleSince: number | null
  revealUntil: number
}

/**
 * Esteira: notas rolam até a linha fixa. Espera = a nota para na linha até
 * ser acertada; Contínua = não para, velocidade ajustada para ~90% de acerto.
 */
export class ConveyorController extends Controller {
  private notes: ConveyorNote[] = []
  private spawned = 0
  private resolvedCount = 0
  private correctCount = 0
  private attemptedCount = 0
  private speed = READING.continuousSpeed * S
  private recent: boolean[] = []
  private endAt: number | null = null
  private readonly gap = READING.conveyorGap * S
  private readonly total: number

  constructor(
    d: ControllerDeps,
    private flow: ConveyorFlow,
  ) {
    super(d)
    this.total = d.settings.sessionLength
  }

  protected begin(now: number) {
    this.fill(now)
    this.hud()
  }

  private get pending(): ConveyorNote[] {
    return this.notes.filter((n) => !n.resolved)
  }

  private spawn(now: number) {
    const item = this.d.session.next()
    const last = this.notes[this.notes.length - 1]
    const x = Math.max(this.d.stage.width + S, last ? last.sn.x + this.gap : this.d.stage.hitNoteX + this.gap)
    const sn = this.d.stage.addNote(item.written, x, this.labelFor(item))
    this.notes.push({ item, sn, resolved: false, first: null, headSince: null, visibleSince: null, revealUntil: 0 })
    this.spawned++
    if (this.flow === 'wait' && this.spawned === 1) {
      // primeira nota já começa na linha
      sn.setX(this.d.stage.hitNoteX)
      this.notes[0].headSince = now
      this.notes[0].visibleSince = now
    }
  }

  private labelFor(item: StudyItem) {
    const opacity = this.d.session.labelOpacity(item.id)
    return { text: opacity > 0 ? namePt(item.written) : '', opacity }
  }

  /** Mantém a fila cheia até a borda direita. */
  private fill(now: number) {
    while (this.spawned < this.total) {
      const last = this.notes[this.notes.length - 1]
      if (last && last.sn.x >= this.d.stage.width) break
      this.spawn(now)
    }
  }

  protected update(now: number, dt: number) {
    const stage = this.d.stage
    if (this.flow === 'wait') {
      const step = READING.waitSpeed * S * dt
      let slot = 0
      for (const n of this.notes) {
        if (n.resolved) continue
        const target = stage.hitNoteX + slot * this.gap
        n.sn.setX(Math.max(target, n.sn.x - step))
        slot++
      }
    } else {
      const step = this.speed * dt
      for (const n of this.notes) n.sn.setX(n.sn.x - step)
      const head = this.pending[0]
      // com microfone a nota só é confirmada ~150 ms após o ataque: margem extra
      const grace = this.d.mic ? this.speed * (DETECTION.attackIgnore + DETECTION.stableTime + 0.12) : 0
      if (head && head.sn.x + NOTEHEAD_W / 2 < stage.hitX - 1.2 * S - grace) this.resolve(head, 'wrong', now, null)
      // notas resolvidas saem pela esquerda
      for (const n of this.notes) if (n.resolved && n.sn.x < 12) n.sn.fadeOut()
      this.notes = this.notes.filter((n) => !(n.resolved && n.sn.x < 12))
    }

    for (const n of this.notes) {
      if (n.visibleSince === null && n.sn.x < stage.width - NOTEHEAD_W) n.visibleSince = now
      if (n.revealUntil && now > n.revealUntil) {
        n.revealUntil = 0
        n.sn.setLabel(this.labelFor(n.item).text, this.labelFor(n.item).opacity)
      }
    }
    const head = this.pending[0]
    if (head && head.headSince === null) head.headSince = now

    this.fill(now)
    if (this.resolvedCount >= this.total && this.pending.length === 0) {
      // um instante para ver o último feedback
      this.endAt ??= now + 0.6
      if (now >= this.endAt) this.complete()
    }
  }

  protected answer(a: Answer): AttemptResult | null {
    const head = this.pending[0]
    if (!head) return null
    const result = judge(head.item, a)
    if (!head.first) this.record(head, result, a.time)
    if (this.flow === 'wait' && result !== 'correct') this.reveal(head, result, a.time, a)
    else this.resolve(head, result, a.time, a)
    return result
  }

  private rtOf(n: ConveyorNote, time: number): number {
    const head = n.headSince ?? time
    const since = Math.max(head, n.visibleSince ?? head)
    return Math.max(0, time - since)
  }

  private record(n: ConveyorNote, result: AttemptResult, time: number) {
    n.first = result
    this.attemptedCount++
    if (result === 'correct') this.correctCount++
    const unlocked = this.d.session.record(n.item.id, result, this.rtOf(n, time))
    this.announceUnlocks(unlocked)
    this.hud()
  }

  private reveal(n: ConveyorNote, result: AttemptResult, time: number, a: Answer | null) {
    n.sn.setState(result === 'wrong-octave' ? 'oct' : 'err')
    n.sn.setLabel(namePt(n.item.written), 1)
    n.revealUntil = time + READING.revealTime
    if (result === 'wrong-octave' && a?.kind === 'mic') {
      this.feedback('oct', 'nota certa, oitava errada', octaveHint(midiOf(n.item.written), a.writtenMidi))
    } else if (a === null) {
      this.feedback('err', namePt(n.item.written), 'passou da linha')
    } else {
      this.feedback('err', namePt(n.item.written), 'era esta')
    }
  }

  private resolve(n: ConveyorNote, result: AttemptResult, time: number, a: Answer | null) {
    if (n.resolved) return
    if (!n.first) this.record(n, result, time)
    n.resolved = true
    this.resolvedCount++
    if (result === 'correct') {
      n.sn.setState('ok')
      n.sn.fadeOut(0.3)
      this.notes = this.notes.filter((x) => x !== n)
      this.feedback('ok', '')
    } else {
      // Contínua: a nota errada segue rolando com o nome à mostra
      this.reveal(n, result, time, a)
    }
    if (this.flow === 'continuous') this.adaptSpeed(n.first === 'correct')
    const next = this.pending[0]
    if (next) next.headSince = time
    this.hud()
  }

  private adaptSpeed(ok: boolean) {
    this.recent.push(ok)
    if (this.recent.length > READING.continuousWindow) this.recent.shift()
    if (this.recent.length < 4) return
    const acc = this.recent.filter(Boolean).length / this.recent.length
    this.speed *= acc >= READING.continuousTarget ? 1.06 : 0.9
    this.speed = Math.min(READING.continuousMaxSpeed * S, Math.max(READING.continuousMinSpeed * S, this.speed))
  }

  private hud() {
    const stats = [{ label: 'acerto', value: percent(this.correctCount, this.attemptedCount) }]
    if (this.flow === 'continuous') stats.push({ label: 'notas/min', value: String(Math.round((this.speed / this.gap) * 60)) })
    this.d.setHud({
      progress: this.resolvedCount / this.total,
      progressText: `${this.resolvedCount}/${this.total}`,
      stats,
    })
  }
}
