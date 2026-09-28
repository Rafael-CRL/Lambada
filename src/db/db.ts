import Dexie, { type EntityTable } from 'dexie'
import type { InputKind, ItemStats, UnlockState } from '../engine/adaptive'
import type { ScaleId } from '../domain/scales'
import { isActivityId, type ActivityId, type ActivityOptions, type ExerciseConfig } from '../exercises/types'

export type Theme = 'dark' | 'light'

export interface Settings {
  id: 'main'
  /** região do braço (Solta/Fechada), comum às atividades do Violão */
  scale: ScaleId
  /** janela de tolerância do modo BPM, ± ms */
  toleranceMs: number
  /** compensação manual de latência do microfone (ms) */
  latencyMs: number
  /** compensação do atraso ao bater o ritmo (ms): positivo = as batidas saem atrasadas */
  tapLatencyMs: number
  audioDeviceId: string
  theme: Theme
  /** ajustes guardados por atividade */
  activities: Partial<Record<ActivityId, Partial<ActivityOptions>>>
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  scale: 'solta',
  toleranceMs: 120,
  latencyMs: 0,
  tapLatencyMs: 0,
  audioDeviceId: '',
  theme: 'dark',
  activities: {},
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
  rhythmLevel?: number
  score?: number
  maxCombo?: number
  /** média do |desvio| de tempo nas notas certas (ms) */
  meanOffsetMs?: number
  /** média com sinal: negativo = adiantado */
  meanSignedOffsetMs?: number
}

export interface BpmRecord {
  /** `${input}:${bpm}:${nível}` */
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

export function recordId(input: InputKind, bpm: number, level = 1): string {
  return `${input}:${bpm}:${level}`
}

export function unlockKey(input: InputKind, scale: ScaleId): string {
  return `${input}:${scale}`
}

/** Onde o usuário parou: uma atividade ou uma lição de trilha. */
export type LastPlace = { kind: 'activity'; id: ActivityId } | { kind: 'lesson'; id: string }

export async function getLastPlace(): Promise<LastPlace | null> {
  const rec = await db.meta.get('lastActivity')
  const v = rec?.value
  if (typeof v !== 'string') return null
  if (v.startsWith('lesson:')) return { kind: 'lesson', id: v.slice('lesson:'.length) }
  return isActivityId(v) ? { kind: 'activity', id: v } : null
}

export async function setLastActivity(id: ActivityId): Promise<void> {
  await db.meta.put({ key: 'lastActivity', value: id })
}

export async function setLastLesson(id: string): Promise<void> {
  await db.meta.put({ key: 'lastActivity', value: `lesson:${id}` })
}

/** Salva ajustes de uma atividade (mesclando com os anteriores). */
export async function saveActivityOptions(id: ActivityId, patch: Partial<ActivityOptions>): Promise<void> {
  const current = await loadSettings()
  await saveSettings({ activities: { ...current.activities, [id]: { ...current.activities[id], ...patch } } })
}

/** Trilha da Pauta: melhor acerto de cada lição e se já passou do mínimo. */
export interface LessonProgress {
  best: number
  done: boolean
  at: number
  /** Desafio: menor tempo médio por nota (s) */
  bestTime?: number
}

/** progresso por id de lição */
export type TrailProgress = Partial<Record<string, LessonProgress>>

export async function loadTrail(): Promise<TrailProgress> {
  const rec = await db.meta.get('trail')
  return (rec?.value as TrailProgress | undefined) ?? {}
}

/** Guarda o resultado de uma lição (o melhor acerto e o melhor tempo ficam). */
export async function saveLessonResult(id: string, accuracy: number, passed: boolean, meanTime?: number): Promise<LessonProgress> {
  const trail = await loadTrail()
  const prev = trail[id]
  const times = [prev?.bestTime, meanTime].filter((t): t is number => t !== undefined)
  const next: LessonProgress = {
    best: Math.max(prev?.best ?? 0, accuracy),
    done: (prev?.done ?? false) || passed,
    at: Date.now(),
    bestTime: times.length ? Math.min(...times) : undefined,
  }
  await db.meta.put({ key: 'trail', value: { ...trail, [id]: next } })
  return next
}

/** Cartões de conceito de uma atividade já vistos (aparecem sozinhos só na primeira vez). */
export async function cardsSeen(key: string): Promise<boolean> {
  const rec = await db.meta.get('seenCards')
  return ((rec?.value as string[] | undefined) ?? []).includes(key)
}

export async function markCardsSeen(key: string): Promise<void> {
  const rec = await db.meta.get('seenCards')
  const seen = (rec?.value as string[] | undefined) ?? []
  if (!seen.includes(key)) await db.meta.put({ key: 'seenCards', value: [...seen, key] })
}
