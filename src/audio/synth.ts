import { midiToFreq } from '../domain/notes'
import { audioContext } from './clock'

/**
 * Retorno sonoro dos botões: corda dedilhada (Karplus-Strong) ou piano
 * (síntese aditiva). Cada nota é sintetizada uma vez e guardada em cache.
 */

export type Timbre = 'guitar' | 'piano'

const DURATION = 1.8
const cache = new Map<string, AudioBuffer>()
let out: GainNode | null = null

export function renderPluck(ctx: BaseAudioContext, midi: number): AudioBuffer {
  const sr = ctx.sampleRate
  const f = midiToFreq(midi)
  // o filtro de média atrasa meia amostra: desconta para afinar
  const period = sr / f - 0.5
  const n0 = Math.floor(period)
  const frac = period - n0
  const length = Math.round(sr * DURATION)
  const y = new Float32Array(length)

  // excitação: ruído (semente fixa, som estável) passado duas vezes por um
  // passa-baixas, para um ataque de corda de nylon e não metálico
  let seed = 12345 + midi
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  let p1 = 0
  let p2 = 0
  for (let i = 0; i <= n0 + 1 && i < length; i++) {
    p1 = p1 * 0.6 + rand() * 0.4
    p2 = p2 * 0.6 + p1 * 0.4
    y[i] = p2
  }
  // sem componente contínua: o filtro de média a preservaria para sempre
  const exc = Math.min(n0 + 2, length)
  let mean = 0
  for (let i = 0; i < exc; i++) mean += y[i]
  mean /= exc
  for (let i = 0; i < exc; i++) y[i] -= mean
  // perda por período para ~2 s de decaimento (−60 dB), mais curta nos agudos
  const t60 = Math.max(0.9, 2.4 - (midi - 40) * 0.035)
  const loss = Math.exp(Math.log(0.001) / (t60 * f))
  for (let i = n0 + 2; i < length; i++) {
    // atraso fracionário por interpolação linear + filtro de média (Karplus-Strong)
    const a = (y[i - n0] + y[i - n0 - 1]) * 0.5
    const b = (y[i - n0 - 1] + y[i - n0 - 2]) * 0.5
    y[i] = loss * ((1 - frac) * a + frac * b)
  }

  let peak = 0
  for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(y[i]))
  const fadeOut = Math.round(sr * 0.25)
  const buf = ctx.createBuffer(1, length, sr)
  const data = buf.getChannelData(0)
  for (let i = 0; i < length; i++) {
    const fadeIn = Math.min(1, i / (sr * 0.002))
    const tail = i > length - fadeOut ? (length - i) / fadeOut : 1
    data[i] = (y[i] / (peak || 1)) * 0.6 * fadeIn * tail
  }
  return buf
}

/**
 * Piano aditivo: parciais levemente inarmônicas, cada uma com duas "cordas"
 * desafinadas alguns cents (batimento) e decaimento mais rápido nos agudos.
 */
export function renderPiano(ctx: BaseAudioContext, midi: number): AudioBuffer {
  const sr = ctx.sampleRate
  const f = midiToFreq(midi)
  const length = Math.round(sr * DURATION)
  const out = new Float32Array(length)
  const inharm = 0.00002 * Math.max(1, midi - 30)
  const tau = Math.max(0.35, 1.4 - (midi - 40) * 0.02)
  for (let n = 1; n <= 12; n++) {
    const fn = n * f * Math.sqrt(1 + inharm * n * n)
    if (fn > sr / 2 - 500) break
    const amp = Math.exp(-(n - 1) * 0.35) / n ** 0.6
    const decay = tau / (1 + 0.45 * (n - 1))
    for (const cents of [-0.9, 0.9]) {
      const w = (2 * Math.PI * fn * 2 ** (cents / 1200)) / sr
      for (let i = 0; i < length; i++) {
        const t = i / sr
        // dois estágios: queda rápida inicial e cauda longa
        const env = 0.65 * Math.exp(-t / decay) + 0.35 * Math.exp(-t / (decay * 4))
        out[i] += amp * env * Math.sin(w * i)
      }
    }
  }
  let peak = 0
  for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(out[i]))
  const fadeOut = Math.round(sr * 0.25)
  const buf = ctx.createBuffer(1, length, sr)
  const data = buf.getChannelData(0)
  for (let i = 0; i < length; i++) {
    const attack = Math.min(1, i / (sr * 0.003))
    const tail = i > length - fadeOut ? (length - i) / fadeOut : 1
    data[i] = (out[i] / (peak || 1)) * 0.6 * attack * tail
  }
  return buf
}

/** Toca a nota (MIDI soando) agora. */
export function playNote(midi: number, timbre: Timbre = 'guitar', volume = 0.7) {
  const ctx = audioContext()
  if (ctx.state !== 'running') return
  const key = `${timbre}:${ctx.sampleRate}:${midi}`
  let buf = cache.get(key)
  if (!buf) {
    buf = timbre === 'piano' ? renderPiano(ctx, midi) : renderPluck(ctx, midi)
    cache.set(key, buf)
  }
  if (!out || out.context !== ctx) {
    out = ctx.createGain()
    out.connect(ctx.destination)
  }
  out.gain.value = volume
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.connect(out)
  src.start()
}
