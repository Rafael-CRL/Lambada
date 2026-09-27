import { READING } from '../config'
import { midiOf, namePt } from '../domain/notes'
import type { StudyItem } from '../domain/scales'
import type { AttemptResult } from '../engine/adaptive'
import { NOTEHEAD_W } from '../staff/geometry'
import { Controller, judge, octaveHint, seconds, type Answer } from './controller'
import type { StageNote } from './stage'

/** Sprint: 60 s, uma nota por vez; a próxima aparece logo após a resposta. */
export class SprintController extends Controller {
  private current: { item: StudyItem; sn: StageNote; shownAt: number } | null = null
  private startedAt = 0
  private nextAt: number | null = null
  private hits = 0
  private answered = 0
  private hitTimes: number[] = []
  private lastHud = 0

  protected begin(now: number) {
    this.startedAt = now
    this.show(now)
    this.hud(now)
  }

  private get x() {
    return (this.d.stage.width + 40) / 2 - NOTEHEAD_W / 2
  }

  private show(now: number) {
    const item = this.d.session.next()
    const opacity = this.d.session.labelOpacity(item.id)
    const sn = this.d.stage.addNote(item.written, this.x, { text: opacity > 0 ? namePt(item.written) : '', opacity })
    this.current = { item, sn, shownAt: now }
  }

  protected update(now: number) {
    const elapsed = now - this.startedAt
    if (elapsed >= READING.sprintDuration) {
      this.current?.sn.fadeOut()
      this.complete()
      return
    }
    if (this.nextAt !== null && now >= this.nextAt) {
      this.nextAt = null
      this.current?.sn.remove()
      this.show(now)
    }
    // posição acompanha redimensionamento
    this.current?.sn.setX(this.x)
    if (now - this.lastHud >= 0.1) this.hud(now)
  }

  protected answer(a: Answer): AttemptResult | null {
    const cur = this.current
    if (!cur || this.nextAt !== null) return null
    const result = judge(cur.item, a)
    const rt = Math.max(0, a.time - cur.shownAt)
    this.announceUnlocks(this.d.session.record(cur.item.id, result, rt))
    this.answered++
    if (result === 'correct') {
      this.hits++
      this.hitTimes.push(rt)
      cur.sn.setState('ok')
      this.nextAt = a.time + READING.sprintAdvanceDelay
      this.feedback('ok', '')
    } else {
      cur.sn.setState(result === 'wrong-octave' ? 'oct' : 'err')
      cur.sn.setLabel(namePt(cur.item.written), 1)
      this.nextAt = a.time + READING.revealTime
      if (result === 'wrong-octave' && a.kind === 'mic')
        this.feedback('oct', 'nota certa, oitava errada', octaveHint(midiOf(cur.item.written), a.writtenMidi))
      else this.feedback('err', namePt(cur.item.written), 'era esta')
    }
    this.hud(a.time)
    return result
  }

  private hud(now: number) {
    this.lastHud = now
    const left = Math.max(0, READING.sprintDuration - (now - this.startedAt))
    const mean = this.hitTimes.length ? this.hitTimes.reduce((a, b) => a + b, 0) / this.hitTimes.length : NaN
    this.d.setHud({
      progress: 1 - left / READING.sprintDuration,
      progressText: `${Math.ceil(left)} s`,
      stats: [
        { label: 'acertos', value: String(this.hits) },
        { label: 'erros', value: String(this.answered - this.hits) },
        { label: 'tempo médio', value: seconds(mean) },
      ],
    })
  }
}
