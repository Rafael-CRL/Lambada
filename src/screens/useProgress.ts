import { useLiveQuery } from 'dexie-react-hooks'
import { db, unlockKey, type Settings } from '../db/db'
import { scaleItems, unlockOrder, type StudyItem } from '../domain/scales'
import { activeItems, isMastered, updateUnlocks, type InputKind, type ItemStats } from '../engine/adaptive'

export interface ProgressSnapshot {
  items: StudyItem[]
  active: StudyItem[]
  stats: Map<string, ItemStats>
  mastered: Set<string>
}

/** Estado de desbloqueio/domínio para entrada + escala atuais (somente leitura). */
export function useProgressSnapshot(settings: Settings, input: InputKind): ProgressSnapshot | undefined {
  return useLiveQuery(async () => {
    const items = unlockOrder(scaleItems(settings.scale, settings.accidentals))
    const rows = await db.itemStats.where('input').equals(input).toArray()
    const stats = new Map(rows.map((r) => [r.noteId, r]))
    const saved = (await db.unlocks.get(unlockKey(input, settings.scale))) ?? { unlocked: [], retired: [] }
    // mesmo cálculo do início de sessão, sem gravar
    const state = updateUnlocks(items, saved, stats, input).state
    const active = activeItems(items, state)
    const mastered = new Set(active.filter((i) => isMastered(stats.get(i.id), input)).map((i) => i.id))
    return { items, active, stats, mastered }
  }, [settings.scale, settings.accidentals, input])
}
