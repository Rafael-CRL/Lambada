import Dexie, { type EntityTable } from 'dexie'
import type { InputKind, ItemStats, UnlockState } from '../engine/adaptive'
import type { ScaleId } from '../domain/scales'
import type { ExerciseConfig } from '../exercises/types'

export type Theme = 'dark' | 'light'

export interface Settings {
  id: 'main'
  scale: ScaleId
  accidentals: boolean
  /** Pauta → violão, modo Repetição */
  repetitions: number
  /** notas por sessão (esteira, adaptativo) */
  sessionLength: number
  bpm: number
  /** janela de tolerância do modo BPM, ± ms */
  toleranceMs: number
  /** compensação manual de latência do microfone (ms) */
  latencyMs: number
  audioDeviceId: string
  theme: Theme
  /** entrada escolhida por último nos modos de leitura */
  readingInput: InputKind
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  scale: 'solta',
  accidentals: false,
  repetitions: 4,
  sessionLength: 40,
  bpm: 60,
  toleranceMs: 120,
  latencyMs: 0,
  audioDeviceId: '',
  theme: 'dark',
  readingInput: 'buttons',
}

export interface UnlockRecord extends UnlockState {
  /** `${input}:${scale}` */
  id: string
}

export interface NoteTally {
  correct: number
  wrong: number
  wrongOctave: number
}

export interface SessionRecord {
  id?: number
  /** chave do modo, ver modeKey() */
  mode: string
  config: ExerciseConfig
  scale: ScaleId
  accidentals: boolean
  input: InputKind
  startedAt: number
  endedAt: number
  /** false quando o usuário saiu antes do fim */
  completed: boolean
  attempts: number
  correct: number
  wrongOctave: number
  /** mediana do tempo de resposta das corretas (s) */
  medianTime: number
  meanTime: number
  perNote: Record<string, NoteTally>
  /** modo BPM */
  bpm?: number
  score?: number
  maxCombo?: number
  /** média do |desvio| de tempo nas notas certas (ms) */
  meanOffsetMs?: number
  /** média com sinal: negativo = adiantado */
  meanSignedOffsetMs?: number
}

export interface BpmRecord {
  /** `${input}:${bpm}` */
  id: string
  input: InputKind
  bpm: number
  score: number
  at: number
}

export interface MetaRecord {
  key: string
  value: unknown
}

export const db = new Dexie('lambada') as Dexie & {
  settings: EntityTable<Settings, 'id'>
  itemStats: EntityTable<ItemStats, 'id'>
  unlocks: EntityTable<UnlockRecord, 'id'>
  sessions: EntityTable<SessionRecord, 'id'>
  records: EntityTable<BpmRecord, 'id'>
  meta: EntityTable<MetaRecord, 'key'>
}

db.version(1).stores({
  settings: 'id',
  itemStats: 'id, input',
  unlocks: 'id',
  sessions: '++id, mode, startedAt',
  records: 'id, bpm',
  meta: 'key',
})

export async function loadSettings(): Promise<Settings> {
  const s = await db.settings.get('main')
  return { ...DEFAULT_SETTINGS, ...s }
}

export async function saveSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const current = await loadSettings()
  await db.settings.put({ ...current, ...patch, id: 'main' })
}

export function unlockKey(input: InputKind, scale: ScaleId): string {
  return `${input}:${scale}`
}

export async function getLastExercise(): Promise<ExerciseConfig | null> {
  const rec = await db.meta.get('lastExercise')
  return (rec?.value as ExerciseConfig | undefined) ?? null
}

export async function setLastExercise(config: ExerciseConfig): Promise<void> {
  await db.meta.put({ key: 'lastExercise', value: config })
}
