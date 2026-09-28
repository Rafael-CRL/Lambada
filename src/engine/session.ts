import { db, type NoteTally, type SessionRecord } from '../db/db'
import { NOTE_SETS, readingItems, scaleItems, unlockOrder, type ScaleId, type StudyItem } from '../domain/scales'
import { inputOf, modeKey, type ExerciseConfig } from '../exercises/types'
import { emptyStats, median, pushAttempt, type AttemptResult, type InputKind, type ItemStats } from './adaptive'
import { NotePicker } from './picker'

/**
 * Notas da sessão: na Leitura, o conjunto escolhido (ou o das lições); no
 * violão, as da região, filtradas pelas da lição ou pelas cordas escolhidas.
 */
export function sessionItems(config: ExerciseConfig, scale: ScaleId, accidentals: boolean): StudyItem[] {
  if (inputOf(config) === 'buttons' && (config.pool || config.notes)) return readingItems(config.pool ?? NOTE_SETS[config.notes!], accidentals)
  const items = unlockOrder(scaleItems(scale, accidentals))
  if (config.pool) return items.filter((i) => config.pool!.includes(i.id))
  return config.strings ? items.filter((i) => config.strings!.includes(i.position.string)) : items
}

/**
 * Sessão de estudo: estado em memória do motor adaptativo para uma entrada e
 * escala, com persistência incremental no IndexedDB.
 */
export class StudySession {
  items: StudyItem[]
  byId: Map<string, StudyItem>
  private stats: Map<string, ItemStats>
  private writes: Promise<unknown> = Promise.resolve()
  private tallies = new Map<string, NoteTally>()
  private times: number[] = []
  readonly startedAt = Date.now()
  private picker: NotePicker

  private constructor(
    readonly config: ExerciseConfig,
    readonly input: InputKind,
    readonly scale: ScaleId,
    public accidentals: boolean,
    stats: Map<string, ItemStats>,
    rng: () => number,
  ) {
    this.items = sessionItems(config, scale, accidentals)
    this.byId = new Map(this.items.map((i) => [i.id, i]))
    this.stats = stats
    // sem desbloqueio: todas as notas da região desde o início
    this.picker = new NotePicker(this.items.map((i) => i.id), rng)
  }

  static async open(config: ExerciseConfig, scale: ScaleId, accidentals: boolean, rng = Math.random) {
    const input = inputOf(config)
    const rows = await db.itemStats.where('input').equals(input).toArray()
    const stats = new Map(rows.map((r) => [r.noteId, r]))
    return new StudySession(config, input, scale, accidentals, stats, rng)
  }

  /** Liga/desliga ♯♭ no meio da sessão: vale para as próximas notas. */
  setAccidentals(on: boolean) {
    if (on === this.accidentals) return
    this.accidentals = on
    this.items = sessionItems(this.config, this.scale, on)
    for (const i of this.items) if (!this.byId.has(i.id)) this.byId.set(i.id, i)
    this.picker.setPool(this.items.map((i) => i.id))
  }

  /** Todas as notas da região (o desbloqueio progressivo está desligado). */
  get active(): StudyItem[] {
    return this.items
  }

  /** Próxima nota: saco embaralhado + reforço das que você errou (ver NotePicker). */
  next(): StudyItem {
    return this.byId.get(this.picker.next(this.stats))!
  }

  /** Marca a nota como a última apresentada (para sequências fixas). */
  presented(id: string) {
    this.picker.presented(id)
  }

  statsOf(id: string): ItemStats | undefined {
    return this.stats.get(id)
  }

  /**
   * Registra uma tentativa (a primeira resposta de cada apresentação).
   * Devolve notas liberadas; sempre vazio enquanto o desbloqueio estiver desligado.
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

    return []
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
