import { navigate, play } from '../app/router'
import { ensureAudioRunning } from '../audio/clock'
import { db, setLastActivity, setLastLesson } from '../db/db'
import type { Practice } from '../lessons/lessons'
import type { ActivityId, ActivityOptions } from './types'

/** Ajustes só desta vez (o treino de uma unidade): valem até abrir outra atividade, sem mexer nos salvos. */
let once: { activity: ActivityId; options: Partial<ActivityOptions> } | null = null

export function onceOptions(id: ActivityId): Partial<ActivityOptions> {
  return once?.activity === id ? once.options : {}
}

/** Chamado direto do clique: libera o AudioContext dentro do gesto do usuário. */
export function startActivity(id: ActivityId, replace = false) {
  once = null
  void ensureAudioRunning()
  void setLastActivity(id)
  play(id, replace)
}

/** Abre uma lição da trilha (também dentro do clique, pelo áudio). */
export function startLesson(id: string, replace = false) {
  void ensureAudioRunning()
  void setLastLesson(id)
  navigate({ name: 'lesson', lesson: id, run: Date.now() }, replace)
}

export function startGuidedStudy(id: string) {
  void ensureAudioRunning()
  void db.meta.put({ key: 'lastActivity', value: `study:${id}` })
  navigate({ name: 'study', id, run: Date.now() })
}

/** Reinicia a atividade na tela (mantém os ajustes só desta vez). */
export function restartActivity(id: ActivityId) {
  void ensureAudioRunning()
  play(id, true)
}

/** Treino da unidade: a atividade da prática com os ajustes da unidade, só desta vez. */
export function startPractice(p: Practice, replace = false) {
  startActivity(p.activity, replace)
  once = { activity: p.activity, options: p.options }
}
