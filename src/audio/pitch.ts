import { PitchDetector as Pitchy } from 'pitchy'

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

class PitchyDetector implements PitchDetector {
  private detectors = new Map<number, Pitchy<Float32Array>>()

  detect(buffer: Float32Array, sampleRate: number): PitchReading | null {
    let d = this.detectors.get(buffer.length)
    if (!d) {
      d = Pitchy.forFloat32Array(buffer.length)
      // o limiar de energia fica com o tracker; aqui só o pitch
      d.minVolumeAbsolute = 0
      this.detectors.set(buffer.length, d)
    }
    const [freq, clarity] = d.findPitch(buffer, sampleRate)
    if (!(freq > 0) || !Number.isFinite(freq)) return null
    return { freq, clarity }
  }
}

export function createPitchDetector(): PitchDetector {
  return new PitchyDetector()
}
