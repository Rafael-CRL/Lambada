import { ADAPTIVE } from '../config'
import type { StudyItem } from '../domain/scales'

/**
 * Motor adaptativo: estatísticas por nota, domínio por janela móvel, sorteio
 * ponderado e desbloqueio progressivo. Funções puras; a persistência fica em db/.
 */

export type InputKind = 'buttons' | 'mic'

export type AttemptResult = 'correct' | 'wrong' | 'wrong-octave'

export interface Attempt {
  result: AttemptResult
  /** tempo de resposta (s) */
  rt: number
  /** epoch ms, só para histórico */
  at: number
}

export interface ItemStats {
  /** `${input}:${noteId}` */
  id: string
  input: InputKind
  noteId: string
  correct: number
  wrong: number
  wrongOctave: number
  /** soma dos tempos das respostas corretas (s) */
  correctTimeSum: number
  /** últimas tentativas (mais recente no fim) */
  recent: Attempt[]
}

export function statsId(input: InputKind, noteId: string): string {
  return `${input}:${noteId}`
}

export function emptyStats(input: InputKind, noteId: string): ItemStats {
  return {
    id: statsId(input, noteId),
    input,
    noteId,
    correct: 0,
    wrong: 0,
    wrongOctave: 0,
    correctTimeSum: 0,
    recent: [],
  }
}

export function pushAttempt(stats: ItemStats, attempt: Attempt, window = ADAPTIVE.window): ItemStats {
  const ok = attempt.result === 'correct'
  return {
    ...stats,
    correct: stats.correct + (ok ? 1 : 0),
    wrong: stats.wrong + (attempt.result === 'wrong' ? 1 : 0),
    wrongOctave: stats.wrongOctave + (attempt.result === 'wrong-octave' ? 1 : 0),
    correctTimeSum: stats.correctTimeSum + (ok ? attempt.rt : 0),
    recent: [...stats.recent, attempt].slice(-window),
  }
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export interface WindowSummary {
  n: number
  accuracy: number
  /** mediana dos tempos das respostas corretas na janela (NaN se nenhuma) */
  medianTime: number
}

export function summarize(stats: ItemStats | undefined): WindowSummary {
  const recent = stats?.recent ?? []
  const hits = recent.filter((a) => a.result === 'correct')
  return {
    n: recent.length,
    accuracy: recent.length ? hits.length / recent.length : 0,
    medianTime: median(hits.map((a) => a.rt)),
  }
}

export function isMastered(stats: ItemStats | undefined, input: InputKind): boolean {
  const s = summarize(stats)
  return (
    s.n >= ADAPTIVE.minAttempts &&
    s.accuracy >= ADAPTIVE.masteryAccuracy &&
    s.medianTime <= ADAPTIVE.masteryMedianTime[input]
  )
}

/** 0 = nada aprendido, 1 = dominada. Controla o fade do rótulo. */
export function masteryProgress(stats: ItemStats | undefined, input: InputKind): number {
  if (isMastered(stats, input)) return 1
  const s = summarize(stats)
  if (s.n === 0) return 0
  const volume = Math.min(1, s.n / ADAPTIVE.minAttempts)
  const acc = Math.min(1, s.accuracy / ADAPTIVE.masteryAccuracy)
  const speed = Number.isNaN(s.medianTime) ? 0 : Math.min(1, ADAPTIVE.masteryMedianTime[input] / s.medianTime)
  return Math.min(0.95, volume * acc * speed)
}

export function itemWeight(stats: ItemStats | undefined, input: InputKind): number {
  const w = ADAPTIVE.weights
  const s = summarize(stats)
  const errorRate = s.n ? 1 - s.accuracy : 0
  const slowness = Number.isNaN(s.medianTime) ? 0 : Math.min(2, s.medianTime / ADAPTIVE.masteryMedianTime[input])
  const novelty = Math.max(0, 1 - s.n / ADAPTIVE.minAttempts)
  const weight = w.base + w.error * errorRate + w.slow * slowness + w.novelty * novelty
  return isMastered(stats, input) ? weight * w.masteredFactor : weight
}

export type Rng = () => number

/**
 * Sorteio ponderado entre os ids ativos, nunca repetindo `lastId`
 * (a não ser que só exista uma nota).
 */
export function pickNext(
  activeIds: string[],
  statsByNote: Map<string, ItemStats>,
  input: InputKind,
  lastId: string | null,
  rng: Rng = Math.random,
): string {
  if (activeIds.length === 0) throw new Error('nenhuma nota ativa')
  const pool = activeIds.length > 1 ? activeIds.filter((id) => id !== lastId) : activeIds
  const weights = pool.map((id) => itemWeight(statsByNote.get(id), input))
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rng() * total
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r < 0) return pool[i]
  }
  return pool[pool.length - 1]
}

// ---------------------------------------------------------------- desbloqueio

export interface UnlockState {
  /** ids de notas liberadas (grafia escrita) */
  unlocked: string[]
  /** notas que já atingiram o limiar uma vez: rótulo não aparece mais */
  retired: string[]
}

export const EMPTY_UNLOCK: UnlockState = { unlocked: [], retired: [] }

/**
 * Próximo item a liberar. Acidentes cujas duas naturais vizinhas já estão
 * ativas têm prioridade; senão a próxima natural na ordem.
 */
function nextToUnlock(order: StudyItem[], unlocked: Set<string>): StudyItem | undefined {
  const activeNaturalMidis = new Set(order.filter((i) => i.natural && unlocked.has(i.id)).map((i) => i.midi))
  const accidental = order.find(
    (i) =>
      !i.natural &&
      !unlocked.has(i.id) &&
      activeNaturalMidis.has(i.midi - 1) &&
      activeNaturalMidis.has(i.midi + 1),
  )
  if (accidental) return accidental
  const natural = order.find((i) => i.natural && !unlocked.has(i.id))
  if (natural) return natural
  // acidentes nas bordas (vizinha fora do âmbito) entram por último
  return order.find((i) => !unlocked.has(i.id))
}

export interface UnlockUpdate {
  state: UnlockState
  /** ids liberados nesta chamada */
  newlyUnlocked: string[]
}

/**
 * Atualiza o estado de desbloqueio para o conjunto de itens atual (`order`,
 * já em ordem de desbloqueio). Libera no máximo uma nota por chamada além do
 * conjunto inicial: a próxima só entra quando todas as ativas estão dominadas.
 */
export function updateUnlocks(
  order: StudyItem[],
  prev: UnlockState,
  statsByNote: Map<string, ItemStats>,
  input: InputKind,
): UnlockUpdate {
  const unlocked = new Set(prev.unlocked)
  const retired = new Set(prev.retired)
  const newly: string[] = []
  const inPool = (id: string) => order.some((i) => i.id === id)

  // conjunto inicial: primeiras naturais da ordem
  let activeCount = order.filter((i) => unlocked.has(i.id)).length
  for (const item of order) {
    if (activeCount >= ADAPTIVE.initialActive) break
    if (!item.natural || unlocked.has(item.id)) continue
    unlocked.add(item.id)
    newly.push(item.id)
    activeCount++
  }

  for (const id of unlocked) if (inPool(id) && isMastered(statsByNote.get(id), input)) retired.add(id)

  const active = order.filter((i) => unlocked.has(i.id))
  const allMastered = active.every((i) => isMastered(statsByNote.get(i.id), input))
  if (allMastered) {
    const next = nextToUnlock(order, unlocked)
    if (next) {
      unlocked.add(next.id)
      newly.push(next.id)
    }
  }

  return {
    state: { unlocked: [...unlocked], retired: [...retired] },
    newlyUnlocked: newly,
  }
}

export function activeItems(order: StudyItem[], state: UnlockState): StudyItem[] {
  const set = new Set(state.unlocked)
  return order.filter((i) => set.has(i.id))
}
