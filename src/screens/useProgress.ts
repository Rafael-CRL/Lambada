import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Settings } from '../db/db'
import { scaleItems, unlockOrder, type StudyItem } from '../domain/scales'
import { isMastered, type InputKind, type ItemStats } from '../engine/adaptive'

export interface ProgressSnapshot {
  items: StudyItem[]
  active: StudyItem[]
  stats: Map<string, ItemStats>
  mastered: Set<string>
}

/** ♯♭ ligados na atividade principal do tópico (Leitura / Notas). */
export function accidentalsFor(settings: Settings, input: InputKind): boolean {
  return !!settings.activities[input === 'buttons' ? 'reading' : 'notes']?.accidentals
}

/** Estado de desbloqueio/domínio para entrada + região atuais (somente leitura). */
export function useProgressSnapshot(settings: Settings, input: InputKind): ProgressSnapshot | undefined {
  const accidentals = accidentalsFor(settings, input)
  // região fixa enquanto não houver o ajuste (ver buildConfig)
  const scale = 'solta' as const
  return useLiveQuery(async () => {
    const items = unlockOrder(scaleItems(scale, accidentals))
    const rows = await db.itemStats.where('input').equals(input).toArray()
    const stats = new Map(rows.map((r) => [r.noteId, r]))
    // desbloqueio desligado: toda a região está ativa
    const active = items
    const mastered = new Set(active.filter((i) => isMastered(stats.get(i.id), input)).map((i) => i.id))
    return { items, active, stats, mastered }
  }, [accidentals, input])
}
