import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { DETECTION } from '../config'
import type { TakeRecord } from '../dev/takes'
import { defaultSpelling, noteId } from '../domain/notes'
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

function detect(samples: Float32Array, sampleRate: number, r: Reading): string[] {
  const tracker = new NoteTracker(createPitchDetector(), sampleRate)
  const size = DETECTION.bufferSize
  let seed = 7919
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const out: string[] = []
  for (let t = size / sampleRate + (r.offset ?? 0); t * sampleRate <= samples.length; t += (1 + (r.jitter ?? 0) * (2 * rand() - 1)) / r.fps) {
    const end = Math.floor(t * sampleRate)
    for (const e of tracker.process(samples.subarray(end - size, end), end / sampleRate)) if (e.type === 'note') out.push(noteId(defaultSpelling(e.midi)))
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
const GHOST = 'Sol3 fraco quando o dedo sai da corda (soa de verdade, mas ninguém tocou)'

/**
 * Limites conhecidos do detector: quantos erros cada gravação ainda tem,
 * somando as leituras. Mais que isso é regressão; menos, o limite baixa.
 */
const KNOWN: Record<string, { max: number; why: string }> = {
  'escala-aberta-lenta': { max: 6, why: `Si3 com o Mi2 solto soando sai como Mi2 (a mistura se repete no período do Mi2); ${GHOST}` },
  'escala-aberta-rapida': { max: 9, why: 'Ré4 e Dó4 com o Sol3 solto soando: a mistura sai como Sol grave, e a nota se perde' },
  'escala-fechada-lenta': { max: 4, why: GHOST },
  'escala-fechada-lenta-2': { max: 5, why: GHOST },
  'escala-fechada-rapida-2': { max: 2, why: 'Mi3 fantasma no fim da descida' },
  'soltas-lenta': { max: 48, why: OPEN_STRINGS },
  'soltas-lenta-2': { max: 32, why: OPEN_STRINGS },
  'soltas-lenta-3': { max: 21, why: OPEN_STRINGS },
  'soltas-rapida': { max: 44, why: OPEN_STRINGS },
  'soltas-rapida-2': { max: 44, why: OPEN_STRINGS },
  'soltas-rapida-3': { max: 44, why: OPEN_STRINGS },
  'soltas-rapida-4': { max: 40, why: OPEN_STRINGS },
}

describe('gravações reais', () => {
  const all = fixtures()
  if (!all.length) return test.skip('nenhuma gravação em src/audio/fixtures/', () => {})
  for (const r of all) {
    const known = KNOWN[r.id]
    test(known ? `${r.id} (até ${known.max} erros: ${known.why})` : r.id, () => {
      const { samples, sampleRate } = decodeWav(readFileSync(new URL(`${r.id}.wav`, DIR)))
      const got = Object.fromEntries(Object.entries(READINGS).map(([name, reading]) => [name, detect(samples, sampleRate, reading)]))
      if (!known) return expect(got).toEqual(Object.fromEntries(Object.keys(READINGS).map((name) => [name, r.expected])))
      const total = Object.values(got).reduce((n, notes) => n + errors(r.expected, notes), 0)
      expect(total, 'mais erros que o limite conhecido: regressão').toBeLessThanOrEqual(known.max)
      expect(total, `melhorou: baixe o limite de ${r.id} em KNOWN para ${total}`).toBe(known.max)
    })
  }
})

test('WAV: ida e volta', () => {
  const x = Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i / 7) * 0.8)
  const { samples, sampleRate } = decodeWav(encodeWav(x, 44100))
  expect(sampleRate).toBe(44100)
  expect(samples).toHaveLength(1000)
  for (let i = 0; i < x.length; i++) expect(Math.abs(samples[i] - x[i])).toBeLessThan(1e-4)
})
