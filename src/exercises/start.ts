import { play } from '../app/router'
import { ensureAudioRunning } from '../audio/clock'
import { setLastExercise } from '../db/db'
import type { ExerciseConfig } from './types'

/** Chamado direto do clique: libera o AudioContext dentro do gesto do usuário. */
export function startExercise(config: ExerciseConfig, replace = false) {
  void ensureAudioRunning()
  void setLastExercise(config)
  play(config, replace)
}
