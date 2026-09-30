import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { DETECTION } from '../config'
import type { TakeRecord } from '../dev/takes'
import { defaultSpelling, midiOf, noteId, parseNote } from '../domain/notes'
import { createPitchDetector } from './pitch'
import { NoteTracker } from './tracker'
import { decodeWav, encodeWav } from './wav'

/**
 * O detector sobre gravações reais do violão (`src/audio/fixtures/`, gravadas
 * em `#/gravar`): as notas achadas têm de ser as tocadas, em ordem.
 */

const DIR = new URL('./fixtures/', import.meta.url)

function fixtures(): TakeRecord[] {
  try {
    return readdirSync(DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8')) as TakeRecord)
  } catch {
    return []
  }
}

/**
 * Lê a gravação como o app lê o AnalyserNode: uma janela de `bufferSize` a
 * cada frame. Ao vivo o frame varia (tela de 60 ou 144 Hz, travadas), e o
 * resultado não pode depender disso.
 */
interface Reading {
  fps: number
  /** variação de cada intervalo entre frames (0,5 = ±50%) */
  jitter?: number
  /** atraso da primeira leitura (s) */
  offset?: number
}

const READINGS: Record<string, Reading> = {
  '60 Hz': { fps: 60 },
  '60 Hz, outra fase': { fps: 60, offset: 0.008 },
  '144 Hz': { fps: 144 },
  '60 Hz irregular': { fps: 60, jitter: 0.5 },
}

/**
 * As notas achadas. Com `sequence` (MIDI soando), como no exercício: o detector
 * sabe a nota esperada, que avança a cada acerto. As gravações foram tocadas
 * direto, sem repetir a nota perdida: se ele ouve a seguinte, a esperada anda
 * junto (senão um erro puxaria outros em cascata).
 */
function detect(samples: Float32Array, sampleRate: number, r: Reading, sequence?: number[]): string[] {
  const tracker = new NoteTracker(createPitchDetector(), sampleRate)
  const size = DETECTION.bufferSize
  let seed = 7919
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const out: string[] = []
  let pos = 0
  for (let t = size / sampleRate + (r.offset ?? 0); t * sampleRate <= samples.length; t += (1 + (r.jitter ?? 0) * (2 * rand() - 1)) / r.fps) {
    const end = Math.floor(t * sampleRate)
    tracker.expected = sequence?.[pos] ?? null
    for (const e of tracker.process(samples.subarray(end - size, end), end / sampleRate)) {
      if (e.type !== 'note') continue
      out.push(noteId(defaultSpelling(e.midi)))
      if (e.midi === sequence?.[pos]) pos++
      else if (sequence && e.midi === sequence[pos + 1]) pos += 2
    }
  }
  return out
}

/** Erros entre o tocado e o achado: notas trocadas, perdidas ou a mais (distância de edição). */
function errors(expected: string[], got: string[]): number {
  let prev = Array.from({ length: got.length + 1 }, (_, j) => j)
  for (let i = 1; i <= expected.length; i++) {
    const row = [i]
    for (let j = 1; j <= got.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (expected[i - 1] === got[j - 1] ? 0 : 1))
    prev = row
  }
  return prev[got.length]
}

const OPEN_STRINGS = 'as cordas soltas soam juntas: polifonia, fora do alcance do detector monofônico'
const SOLTA = 'sozinho, notas curtas com cordas soltas soando pedem a nota esperada'
const FAST = 'escala a 3,3–4,4 notas/s: Ré4 e Fá4 curtos e fracos, misturados com cordas soltas, se perdem'
const GHOST = 'Sol3 fraco quando o dedo sai da corda (soa de verdade, mas ninguém tocou)'

/**
 * Limites conhecidos do detector: quantos erros cada gravação ainda tem,
 * somando as leituras. Mais que isso é regressão; menos, o limite baixa.
 */
const KNOWN: Record<string, { sozinho?: number; exercicio?: number; why: string }> = {
  'escala-aberta-rapida': { sozinho: 5, exercicio: 1, why: 'Ré4 com o Sol3 solto soando: a mistura sai como Sol grave, e a nota se perde' },
  'escala-fechada-lenta-2': { sozinho: 2, exercicio: 2, why: GHOST },
  'escala-solta-1': { sozinho: 4, why: SOLTA },
  'escala-solta-3': { sozinho: 21, exercicio: 5, why: FAST },
  'escala-solta-voltas-1': { sozinho: 2, exercicio: 2, why: SOLTA },
  'escala-solta-voltas-2': { sozinho: 7, exercicio: 4, why: SOLTA },
  'escala-solta-voltas-3': { sozinho: 4, why: SOLTA },
  'escala-solta-voltas-4': { sozinho: 22, exercicio: 18, why: FAST },
  'escala-solta-voltas-5': { sozinho: 22, exercicio: 9, why: FAST },
  'escala-solta-voltas-6': { sozinho: 8, exercicio: 4, why: SOLTA },
  'escala-solta-voltas-7': { sozinho: 25, exercicio: 16, why: FAST },
  'escala-solta-voltas-8': { sozinho: 41, exercicio: 16, why: FAST },
  'soltas-lenta': { sozinho: 48, exercicio: 48, why: OPEN_STRINGS },
  'soltas-lenta-2': { sozinho: 28, exercicio: 28, why: OPEN_STRINGS },
  'soltas-lenta-3': { sozinho: 23, exercicio: 22, why: OPEN_STRINGS },
  'soltas-rapida': { sozinho: 44, exercicio: 40, why: OPEN_STRINGS },
  'soltas-rapida-2': { sozinho: 44, exercicio: 44, why: OPEN_STRINGS },
  'soltas-rapida-3': { sozinho: 44, exercicio: 34, why: OPEN_STRINGS },
  'soltas-rapida-4': { sozinho: 40, exercicio: 40, why: OPEN_STRINGS },
}

const MODES = {
  sozinho: { exercise: false, label: 'o detector sozinho' },
  exercicio: { exercise: true, label: 'no exercício (sabe a nota esperada)' },
} as const

for (const [mode, { exercise, label }] of Object.entries(MODES)) {
  describe(`gravações reais: ${label}`, () => {
    const all = fixtures()
    if (!all.length) return test.skip('nenhuma gravação em src/audio/fixtures/', () => {})
    for (const r of all) {
      const known = KNOWN[r.id]
      const max = known?.[mode as keyof typeof MODES]
      test(max ? `${r.id} (até ${max} erros: ${known!.why})` : r.id, () => {
        const { samples, sampleRate } = decodeWav(readFileSync(new URL(`${r.id}.wav`, DIR)))
        const sequence = exercise ? r.expected.map((id) => midiOf(parseNote(id))) : undefined
        const got = Object.fromEntries(Object.entries(READINGS).map(([name, reading]) => [name, detect(samples, sampleRate, reading, sequence)]))
        if (!max) return expect(got).toEqual(Object.fromEntries(Object.keys(READINGS).map((name) => [name, r.expected])))
        const total = Object.values(got).reduce((n, notes) => n + errors(r.expected, notes), 0)
        expect(total, 'mais erros que o limite conhecido: regressão').toBeLessThanOrEqual(max)
        expect(total, `melhorou: baixe o limite de ${r.id} (${mode}) em KNOWN para ${total}`).toBe(max)
      })
    }
  })
}

test('WAV: ida e volta', () => {
  const x = Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i / 7) * 0.8)
  const { samples, sampleRate } = decodeWav(encodeWav(x, 44100))
  expect(sampleRate).toBe(44100)
  expect(samples).toHaveLength(1000)
  for (let i = 0; i < x.length; i++) expect(Math.abs(samples[i] - x[i])).toBeLessThan(1e-4)
})
