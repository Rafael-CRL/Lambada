import { navigate, play } from '../app/router'
import { ensureAudioRunning } from '../audio/clock'
import { setLastActivity } from '../db/db'
import type { LessonId } from '../lessons/lessons'
import type { ActivityId } from './types'

/** Chamado direto do clique: libera o AudioContext dentro do gesto do usuário. */
export function startActivity(id: ActivityId, replace = false) {
  void ensureAudioRunning()
  void setLastActivity(id)
  play(id, replace)
}

/** Abre uma lição da trilha (também dentro do clique, pelo áudio). */
export function startLesson(id: LessonId, replace = false) {
  void ensureAudioRunning()
  navigate({ name: 'lesson', lesson: id, run: Date.now() }, replace)
}
