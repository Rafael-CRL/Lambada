/**
 * AudioContext único do app e relógio musical derivado dele.
 *
 * Todo timing musical usa segundos do AudioContext. `clock()` devolve o tempo
 * de áudio que está saindo no alto-falante no instante dado (via
 * getOutputTimestamp), o que deixa a animação suave e sincronizada com o que
 * se ouve. Eventos do microfone são convertidos para o mesmo domínio.
 */

let ctx: AudioContext | null = null

export function audioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext({ latencyHint: 'interactive' })
  return ctx
}

/**
 * Recria o contexto com outra taxa de amostragem. Necessário no Firefox,
 * que não conecta um microfone com taxa diferente da do contexto.
 */
export async function recreateAudioContext(sampleRate: number): Promise<AudioContext> {
  const old = ctx
  ctx = new AudioContext({ latencyHint: 'interactive', sampleRate })
  await old?.close().catch(() => {})
  return ctx
}

export function isAudioRunning(): boolean {
  return ctx?.state === 'running'
}

/** Precisa ser chamado a partir de um gesto do usuário na primeira vez. */
export async function ensureAudioRunning(): Promise<boolean> {
  const c = audioContext()
  if (c.state !== 'running') {
    // sem gesto do usuário o Chrome deixa resume() pendente indefinidamente
    const timeout = new Promise((r) => setTimeout(r, 300))
    await Promise.race([c.resume().catch(() => {}), timeout])
  }
  return c.state === 'running'
}

/** Latência de saída estimada (s): quanto o grafo está à frente do alto-falante. */
export function outputLatency(): number {
  const c = audioContext()
  return (c.baseLatency || 0) + (c.outputLatency || 0)
}

/**
 * Relógio do app: tempo de áudio (s) alinhado à saída, no instante
 * `perfNow` (performance.now() ou event.timeStamp).
 */
export function clock(perfNow = performance.now()): number {
  const c = audioContext()
  if (typeof c.getOutputTimestamp === 'function') {
    const ts = c.getOutputTimestamp()
    if (ts.performanceTime && ts.contextTime !== undefined && ts.performanceTime > 0) {
      return ts.contextTime + (perfNow - ts.performanceTime) / 1000
    }
  }
  return c.currentTime - outputLatency() + (perfNow - performance.now()) / 1000
}
