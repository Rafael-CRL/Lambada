import { play } from '../app/router'
import { ensureAudioRunning } from '../audio/clock'
import { setLastActivity } from '../db/db'
import type { ActivityId } from './types'

/** Chamado direto do clique: libera o AudioContext dentro do gesto do usuário. */
export function startActivity(id: ActivityId, replace = false) {
  void ensureAudioRunning()
  void setLastActivity(id)
  play(id, replace)
}
