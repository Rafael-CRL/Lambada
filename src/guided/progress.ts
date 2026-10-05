import { db } from '../db/db'
import type { Tempo } from '../exercises/types'
import type { Study } from './catalog'

export type StudyMode = 'mic' | 'practice' | 'listen'
export interface StudyOptions { bpm: number; tempo: Tempo; mode: StudyMode; loops: number }
export interface StudyProgress {
  practiced: number
  bestAccuracy?: number
  bestBpm?: number
  at: number
}
export type GuidedProgress = Record<string, StudyProgress>

export function defaultOptions(study: Study): StudyOptions {
  return { bpm: 60, tempo: study.polyphonic ? 'metronome' : 'free', mode: study.polyphonic ? 'practice' : 'mic', loops: 1 }
}
export function normalizeOptions(study: Study, saved: Partial<StudyOptions>): StudyOptions {
  const defaults = defaultOptions(study)
  const mode = ['mic', 'practice', 'listen'].includes(saved.mode ?? '') ? saved.mode! : defaults.mode
  return {
    bpm: Number.isFinite(saved.bpm) ? Math.max(30, Math.min(200, saved.bpm!)) : defaults.bpm,
    mode: study.polyphonic && mode === 'mic' ? 'practice' : mode,
    tempo: mode !== 'mic' || study.polyphonic ? 'metronome' : saved.tempo === 'metronome' ? 'metronome' : 'free',
    loops: [1, 2, 4].includes(saved.loops ?? 1) ? saved.loops ?? 1 : 1,
  }
}
export async function loadStudyOptions(study: Study): Promise<StudyOptions> {
  const rec = await db.meta.get(`study-options:${study.id}`)
  return normalizeOptions(study, (rec?.value as Partial<StudyOptions>) ?? defaultOptions(study))
}
export async function saveStudyOptions(id: string, options: StudyOptions) {
  await db.meta.put({ key: `study-options:${id}`, value: options })
}
export async function loadGuidedProgress(): Promise<GuidedProgress> {
  return (await db.meta.get('guided-progress'))?.value as GuidedProgress ?? {}
}
/** Ouvir não é praticar; prática sem avaliação nunca gera acerto ou BPM dominado. */
export async function saveGuidedResult(id: string, options: StudyOptions, accuracy?: number) {
  if (options.mode === 'listen') return
  await db.transaction('rw', db.meta, async () => {
    const progress = await loadGuidedProgress()
    const prev = progress[id]
    const measured = options.mode === 'mic' && accuracy !== undefined
    const masteredBpm = measured && accuracy >= 0.9 && options.tempo === 'metronome' ? options.bpm : undefined
    progress[id] = {
      practiced: (prev?.practiced ?? 0) + 1,
      at: Date.now(),
      bestAccuracy: measured ? Math.max(prev?.bestAccuracy ?? 0, accuracy) : prev?.bestAccuracy,
      bestBpm: masteredBpm === undefined ? prev?.bestBpm : Math.max(prev?.bestBpm ?? 0, masteredBpm),
    }
    await db.meta.put({ key: 'guided-progress', value: progress })
  })
}
