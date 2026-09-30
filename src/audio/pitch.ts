import { Autocorrelator } from 'pitchy'
import { DETECTION } from '../config'

/**
 * Adaptador de detecção de pitch. Todo o resto do app depende apenas desta
 * interface; trocar o algoritmo (ex.: @audio/pitch com YIN/pYIN) é mudar só
 * este arquivo.
 */
export interface PitchReading {
  freq: number
  clarity: number
}

export interface PitchDetector {
  detect(buffer: Float32Array, sampleRate: number): PitchReading | null
}

/** Faixa buscada (Hz). */
export interface PitchRange {
  minFreq: number
  maxFreq: number
}

/**
 * McLeod (MPM), como o pitchy, mas escolhendo o pico só entre os períodos da
 * faixa do violão. O pitchy olha a janela inteira: nos períodos longos
 * (~25–50 Hz) a NSDF é calculada sobre poucas amostras e dá picos altos por
 * acaso, que elevam o limiar e tiram o lugar do período certo. Numa escala
 * real, o Ré4 logo depois de um ataque saía como Sol0/Sol1 metade das vezes e
 * nunca ficava estável.
 */
class McLeodDetector implements PitchDetector {
  private autocorrelators = new Map<number, Autocorrelator<Float32Array>>()
  private nsdf = new Float32Array(0)
  private readonly k = 0.9

  constructor(private range: PitchRange) {}

  detect(buffer: Float32Array, sampleRate: number): PitchReading | null {
    const n = buffer.length
    let ac = this.autocorrelators.get(n)
    if (!ac) {
      ac = Autocorrelator.forFloat32Array(n)
      this.autocorrelators.set(n, ac)
    }
    if (this.nsdf.length !== n) this.nsdf = new Float32Array(n)
    const nsdf = ac.autocorrelate(buffer, this.nsdf)

    // período mais longo aceito (+1 para o refinamento ter vizinho)
    const maxLag = Math.min(n - 2, Math.ceil(sampleRate / this.range.minFreq) + 1)
    let m = 2 * nsdf[0]
    if (!(m > 0)) return null
    for (let i = 0; i <= maxLag + 1; i++) {
      nsdf[i] = (2 * nsdf[i]) / m
      m -= buffer[i] ** 2 + buffer[n - i - 1] ** 2
    }

    // máximos-chave: o maior de cada trecho positivo depois de um cruzamento por zero
    const keys: number[] = []
    let looking = false
    let best = -1
    for (let i = 1; i <= maxLag; i++) {
      if (nsdf[i - 1] <= 0 && nsdf[i] > 0) {
        looking = true
        best = i
      } else if (nsdf[i - 1] > 0 && nsdf[i] <= 0) {
        looking = false
        if (best !== -1) keys.push(best)
        best = -1
      } else if (looking && nsdf[i] > nsdf[best]) best = i
    }
    if (looking && best !== -1 && best < maxLag) keys.push(best)
    if (!keys.length) return null

    let nMax = -Infinity
    for (const i of keys) nMax = Math.max(nMax, nsdf[i])
    const index = keys.find((i) => nsdf[i] >= this.k * nMax)!
    const [x, clarity] = refine(index, nsdf)
    const freq = sampleRate / x
    if (!(freq > 0) || !Number.isFinite(freq)) return null
    return { freq, clarity: Math.min(clarity, 1) }
  }
}

/** Vértice da parábola pelos três pontos em torno do pico. */
function refine(i: number, d: Float32Array): [number, number] {
  const y0 = d[i - 1]
  const y1 = d[i]
  const y2 = d[i + 1]
  const a = (y0 + y2) / 2 - y1
  if (a === 0) return [i, y1]
  const shift = (y0 - y2) / (4 * a)
  return [i + shift, y1 - a * shift * shift]
}

export function createPitchDetector(range: PitchRange = DETECTION): PitchDetector {
  return new McLeodDetector(range)
}
