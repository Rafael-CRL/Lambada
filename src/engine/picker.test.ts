import { describe, expect, test } from 'vitest'
import { PICKER } from '../config'
import { emptyStats, pushAttempt, type AttemptResult, type ItemStats } from './adaptive'
import { NotePicker } from './picker'

function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
}

const NOTES = Array.from({ length: 17 }, (_, i) => `N${i}`)

function statsWith(errors: Record<string, number>): Map<string, ItemStats> {
  const m = new Map<string, ItemStats>()
  for (const [id, n] of Object.entries(errors)) {
    let s = emptyStats('buttons', id)
    for (let i = 0; i < 10; i++) s = pushAttempt(s, { result: (i < n ? 'wrong' : 'correct') as AttemptResult, rt: 1, at: 0 })
    m.set(id, s)
  }
  return m
}

describe('sorteio com aleatoriedade controlada', () => {
  test('sem erros: cada rodada é uma permutação de todas as notas', () => {
    const p = new NotePicker(NOTES, seeded(3))
    const stats = new Map()
    for (let round = 0; round < 5; round++) {
      const got = Array.from({ length: NOTES.length }, () => p.next(stats))
      expect(new Set(got).size).toBe(NOTES.length)
    }
  })

  test('nunca a mesma nota duas vezes seguidas, inclusive na virada do saco', () => {
    const p = new NotePicker(NOTES, seeded(9))
    const stats = statsWith({ N0: 10, N1: 9 })
    let last = ''
    for (let i = 0; i < 2000; i++) {
      const id = p.next(stats)
      expect(id).not.toBe(last)
      last = id
    }
  })

  test('com erros: exatamente 3 reforços por bloco de 10, só para notas com erro, no máximo 1 por nota', () => {
    const rng = seeded(11)
    const p = new NotePicker(NOTES, rng)
    const stats = statsWith({ N3: 2, N7: 5, N12: 1, N15: 4 })
    const erred = new Set(['N3', 'N7', 'N12', 'N15'])
    // conta, por bloco, as saídas além da cota do saco
    let seenBag = 0
    const counts = new Map<string, number>()
    for (let i = 0; i < 1000; i++) {
      const id = p.next(stats)
      counts.set(id, (counts.get(id) ?? 0) + 1)
      seenBag++
    }
    // notas sem erro saem só pelo saco: ~ (1000 * 7/10) / 17 vezes
    const bagShare = (1000 * (PICKER.block - PICKER.weightedPerBlock)) / PICKER.block / NOTES.length
    for (const id of NOTES.filter((n) => !erred.has(n))) {
      expect(counts.get(id)!).toBeGreaterThan(bagShare * 0.8)
      expect(counts.get(id)!).toBeLessThan(bagShare * 1.2)
    }
    // notas com erro saem mais, mas nenhuma domina a fila
    for (const id of erred) expect(counts.get(id)!).toBeGreaterThan(bagShare * 1.2)
    for (const id of erred) expect(counts.get(id)!).toBeLessThan(1000 / PICKER.block + bagShare * 1.3)
    expect(seenBag).toBe(1000)
  })

  test('quando há mais notas erradas que vagas, mais erros = mais reforço', () => {
    const p = new NotePicker(NOTES, seeded(5))
    const stats = statsWith({ N1: 1, N2: 6, N3: 1, N4: 1, N5: 1 })
    const c: Record<string, number> = { N1: 0, N2: 0 }
    for (let i = 0; i < 3000; i++) {
      const id = p.next(stats)
      if (id in c) c[id]++
    }
    expect(c.N2).toBeGreaterThan(c.N1)
  })

  test('acertos recentes apagam o reforço (erro antigo não persegue a nota)', () => {
    let s = emptyStats('buttons', 'N0')
    for (let i = 0; i < 3; i++) s = pushAttempt(s, { result: 'wrong', rt: 1, at: 0 })
    for (let i = 0; i < 10; i++) s = pushAttempt(s, { result: 'correct', rt: 1, at: 0 })
    const p = new NotePicker(NOTES, seeded(1))
    expect(p.recentErrors(s)).toBe(0)
  })

  test('ligar ♯♭ no meio coloca as notas novas no saco atual', () => {
    const p = new NotePicker(['A', 'B', 'C'], seeded(2))
    const stats = new Map()
    p.next(stats)
    p.setPool(['A', 'B', 'C', 'X', 'Y'])
    const got = new Set(Array.from({ length: 12 }, () => p.next(stats)))
    expect(got.has('X') && got.has('Y')).toBe(true)
  })
})
