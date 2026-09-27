import { db, unlockKey, type NoteTally, type SessionRecord } from '../db/db'
import { scaleItems, unlockOrder, type ScaleId, type StudyItem } from '../domain/scales'
import { inputOf, modeKey, type ExerciseConfig } from '../exercises/types'
import {
  activeItems,
  EMPTY_UNLOCK,
  emptyStats,
  masteryProgress,
  median,
  pickNext,
  pushAttempt,
  updateUnlocks,
  type AttemptResult,
  type InputKind,
  type ItemStats,
  type UnlockState,
} from './adaptive'

/**
 * Sessão de estudo: estado em memória do motor adaptativo para uma entrada e
 * escala, com persistência incremental no IndexedDB.
 */
export class StudySession {
  items: StudyItem[]
  byId: Map<string, StudyItem>
  private stats: Map<string, ItemStats>
  private unlock: UnlockState
  private lastId: string | null = null
  private writes: Promise<unknown> = Promise.resolve()
  private tallies = new Map<string, NoteTally>()
  private times: number[] = []
  readonly startedAt = Date.now()
  private rng: () => number

  private constructor(
    readonly config: ExerciseConfig,
    readonly input: InputKind,
    readonly scale: ScaleId,
    public accidentals: boolean,
    stats: Map<string, ItemStats>,
    unlock: UnlockState,
    rng: () => number,
  ) {
    this.items = unlockOrder(scaleItems(scale, accidentals))
    this.byId = new Map(this.items.map((i) => [i.id, i]))
    this.stats = stats
    this.rng = rng
    this.unlock = unlock
    const up = updateUnlocks(this.items, unlock, stats, input)
    this.unlock = up.state
    if (up.newlyUnlocked.length) this.persistUnlock()
  }

  static async open(config: ExerciseConfig, scale: ScaleId, accidentals: boolean, rng = Math.random) {
    const input = inputOf(config)
    const rows = await db.itemStats.where('input').equals(input).toArray()
    const stats = new Map(rows.map((r) => [r.noteId, r]))
    const unlock = (await db.unlocks.get(unlockKey(input, scale))) ?? EMPTY_UNLOCK
    return new StudySession(config, input, scale, accidentals, stats, { unlocked: unlock.unlocked, retired: unlock.retired }, rng)
  }

  /** Liga/desliga ♯♭ no meio da sessão: vale para as próximas notas. */
  setAccidentals(on: boolean) {
    if (on === this.accidentals) return
    this.accidentals = on
    this.items = unlockOrder(scaleItems(this.scale, on))
    for (const i of this.items) if (!this.byId.has(i.id)) this.byId.set(i.id, i)
    const up = updateUnlocks(this.items, this.unlock, this.stats, this.input)
    this.unlock = up.state
    if (up.newlyUnlocked.length) this.persistUnlock()
  }

  get active(): StudyItem[] {
    return activeItems(this.items, this.unlock)
  }

  /** Próxima nota pelo sorteio ponderado. */
  next(): StudyItem {
    const id = pickNext(
      this.active.map((i) => i.id),
      this.stats,
      this.input,
      this.lastId,
      this.rng,
    )
    this.lastId = id
    return this.byId.get(id)!
  }

  /** Marca a nota como a última apresentada (para sequências fixas). */
  presented(id: string) {
    this.lastId = id
  }

  /** Opacidade do rótulo com o nome: 0 quando a nota já atingiu o limiar. */
  labelOpacity(id: string): number {
    if (this.unlock.retired.includes(id)) return 0
    return 1 - 0.75 * masteryProgress(this.stats.get(id), this.input)
  }

  statsOf(id: string): ItemStats | undefined {
    return this.stats.get(id)
  }

  /**
   * Registra uma tentativa (a primeira resposta de cada apresentação).
   * Retorna as notas liberadas por ela.
   */
  record(id: string, result: AttemptResult, rt: number): StudyItem[] {
    const prev = this.stats.get(id) ?? emptyStats(this.input, id)
    const next = pushAttempt(prev, { result, rt, at: Date.now() })
    this.stats.set(id, next)
    this.enqueue(() => db.itemStats.put(next))

    const t = this.tallies.get(id) ?? { correct: 0, wrong: 0, wrongOctave: 0 }
    if (result === 'correct') {
      t.correct++
      this.times.push(rt)
    } else if (result === 'wrong') t.wrong++
    else t.wrongOctave++
    this.tallies.set(id, t)

    const up = updateUnlocks(this.items, this.unlock, this.stats, this.input)
    const changed = up.newlyUnlocked.length > 0 || up.state.retired.length !== this.unlock.retired.length
    this.unlock = up.state
    if (changed) this.persistUnlock()
    return up.newlyUnlocked.map((u) => this.byId.get(u)!)
  }

  get attempts(): number {
    let n = 0
    for (const t of this.tallies.values()) n += t.correct + t.wrong + t.wrongOctave
    return n
  }

  get correctCount(): number {
    let n = 0
    for (const t of this.tallies.values()) n += t.correct
    return n
  }

  private persistUnlock() {
    const rec = { id: unlockKey(this.input, this.scale), ...this.unlock }
    this.enqueue(() => db.unlocks.put(rec))
  }

  private enqueue(write: () => Promise<unknown>) {
    this.writes = this.writes.then(write).catch((e) => console.error('[db]', e))
  }

  /** Monta e salva o registro da sessão. Sessões sem tentativas não são salvas. */
  async finish(completed: boolean, extra: Partial<SessionRecord> = {}): Promise<SessionRecord | null> {
    await this.writes
    if (this.attempts === 0) return null
    let wrongOctave = 0
    for (const t of this.tallies.values()) wrongOctave += t.wrongOctave
    const rec: SessionRecord = {
      mode: modeKey(this.config),
      config: this.config,
      scale: this.scale,
      accidentals: this.accidentals,
      input: this.input,
      startedAt: this.startedAt,
      endedAt: Date.now(),
      completed,
      attempts: this.attempts,
      correct: this.correctCount,
      wrongOctave,
      medianTime: median(this.times),
      meanTime: this.times.length ? this.times.reduce((a, b) => a + b, 0) / this.times.length : NaN,
      perNote: Object.fromEntries(this.tallies),
      ...extra,
    }
    rec.id = await db.sessions.add(rec)
    return rec
  }
}
