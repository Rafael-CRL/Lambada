import { PICKER } from '../config'
import type { ItemStats } from './adaptive'

/**
 * Aleatoriedade controlada para escolher a próxima nota.
 *
 * - Saco embaralhado: todas as notas da região saem uma vez por rodada, em
 *   ordem aleatória; ao esvaziar, embaralha de novo. Garante variedade.
 * - Reforço: em cada bloco de `block` notas, exatamente `weightedPerBlock`
 *   posições (sorteadas) vão para notas com erro recente, proporcional ao
 *   número de erros nas últimas `errorWindow` tentativas daquela nota. Cada
 *   nota ganha no máximo `capPerBlock` reforço por bloco. Sem erros recentes,
 *   a vaga volta para o saco.
 * - Nunca a mesma nota duas vezes seguidas.
 */
export class NotePicker {
  private pool: string[]
  private bag: string[] = []
  private schedule: boolean[] = []
  private reinforcedInBlock = new Map<string, number>()
  private last: string | null = null

  constructor(
    ids: string[],
    private rng: () => number = Math.random,
    private p = PICKER,
  ) {
    this.pool = [...ids]
  }

  /** Troca o conjunto de notas (ex.: ♯♭ ligados no meio da sessão). */
  setPool(ids: string[]) {
    const added = ids.filter((id) => !this.pool.includes(id))
    this.pool = [...ids]
    this.bag = this.bag.filter((id) => ids.includes(id))
    // notas novas entram no saco atual em posições aleatórias
    for (const id of added) this.bag.splice(Math.floor(this.rng() * (this.bag.length + 1)), 0, id)
  }

  /** Marca a nota como a última apresentada (sequências fixas, como a escala). */
  presented(id: string) {
    this.last = id
  }

  next(stats: Map<string, ItemStats>): string {
    if (this.pool.length === 0) throw new Error('nenhuma nota')
    if (this.schedule.length === 0) this.newBlock()
    const reinforce = this.schedule.shift()!
    const id = (reinforce && this.pickReinforcement(stats)) || this.pickFromBag()
    this.last = id
    return id
  }

  /** Erros (inclusive de oitava) nas últimas tentativas da nota. */
  recentErrors(stats: ItemStats | undefined): number {
    if (!stats) return 0
    return stats.recent.slice(-this.p.errorWindow).filter((a) => a.result !== 'correct').length
  }

  private newBlock() {
    const slots = Array.from({ length: this.p.block }, (_, i) => i < this.p.weightedPerBlock)
    this.schedule = shuffle(slots, this.rng)
    this.reinforcedInBlock.clear()
  }

  private pickReinforcement(stats: Map<string, ItemStats>): string | null {
    const candidates = this.pool
      .filter((id) => id !== this.last && (this.reinforcedInBlock.get(id) ?? 0) < this.p.capPerBlock)
      .map((id) => ({ id, w: this.recentErrors(stats.get(id)) }))
      .filter((c) => c.w > 0)
    if (candidates.length === 0) return null
    const total = candidates.reduce((s, c) => s + c.w, 0)
    let r = this.rng() * total
    let pick = candidates[candidates.length - 1].id
    for (const c of candidates) {
      r -= c.w
      if (r < 0) {
        pick = c.id
        break
      }
    }
    this.reinforcedInBlock.set(pick, (this.reinforcedInBlock.get(pick) ?? 0) + 1)
    return pick
  }

  private pickFromBag(): string {
    if (this.pool.length === 1) return this.pool[0]
    if (this.bag.length === 0) this.bag = shuffle([...this.pool], this.rng)
    // evita repetir a última (inclusive na virada do saco)
    let i = this.bag.findIndex((id) => id !== this.last)
    if (i < 0) {
      // só sobrou a própria última: começa uma rodada nova e a mantém no fim
      const rest = shuffle(this.pool.filter((id) => id !== this.last), this.rng)
      this.bag = [...rest, ...this.bag]
      i = 0
    }
    return this.bag.splice(i, 1)[0]
  }
}

export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
