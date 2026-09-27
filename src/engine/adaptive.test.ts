import { describe, expect, test } from 'vitest'
import { ADAPTIVE } from '../config'
import { scaleItems, unlockOrder } from '../domain/scales'
import {
  activeItems,
  EMPTY_UNLOCK,
  emptyStats,
  isMastered,
  itemWeight,
  masteryProgress,
  median,
  pickNext,
  pushAttempt,
  summarize,
  updateUnlocks,
  type AttemptResult,
  type ItemStats,
} from './adaptive'

function withAttempts(noteId: string, results: [AttemptResult, number][], input: 'buttons' | 'mic' = 'buttons') {
  let s = emptyStats(input, noteId)
  for (const [result, rt] of results) s = pushAttempt(s, { result, rt, at: 0 })
  return s
}

const good = (n: number, rt = 1): [AttemptResult, number][] => Array.from({ length: n }, () => ['correct', rt])

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

describe('estatísticas', () => {
  test('contadores separam erro de oitava', () => {
    const s = withAttempts('E5', [['correct', 1], ['wrong', 2], ['wrong-octave', 1.5]])
    expect(s.correct).toBe(1)
    expect(s.wrong).toBe(1)
    expect(s.wrongOctave).toBe(1)
    expect(s.correctTimeSum).toBe(1)
  })

  test('janela móvel guarda só as últimas tentativas', () => {
    const s = withAttempts('E5', [...Array.from({ length: 5 }, (): [AttemptResult, number] => ['wrong', 1]), ...good(10)])
    expect(s.recent).toHaveLength(ADAPTIVE.window)
    expect(summarize(s).accuracy).toBe(1)
    expect(s.wrong).toBe(5)
  })

  test('mediana', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
    expect(median([])).toBeNaN()
  })
})

describe('domínio', () => {
  test('exige volume mínimo, acerto e tempo', () => {
    expect(isMastered(withAttempts('E5', good(ADAPTIVE.minAttempts - 1)), 'buttons')).toBe(false)
    expect(isMastered(withAttempts('E5', good(ADAPTIVE.minAttempts)), 'buttons')).toBe(true)
    expect(isMastered(withAttempts('E5', good(10, 5)), 'buttons')).toBe(false)
    expect(isMastered(withAttempts('E5', good(10, 2.5), 'mic'), 'mic')).toBe(true)
    const mixed = withAttempts('E5', [...good(8), ['wrong', 1], ['wrong-octave', 1]])
    expect(summarize(mixed).accuracy).toBe(0.8)
    expect(isMastered(mixed, 'buttons')).toBe(false)
  })

  test('progresso do rótulo cresce até 1', () => {
    expect(masteryProgress(undefined, 'buttons')).toBe(0)
    const p3 = masteryProgress(withAttempts('E5', good(3)), 'buttons')
    const p5 = masteryProgress(withAttempts('E5', good(5)), 'buttons')
    expect(p3).toBeGreaterThan(0)
    expect(p5).toBeGreaterThan(p3)
    expect(p5).toBeLessThan(1)
    expect(masteryProgress(withAttempts('E5', good(6)), 'buttons')).toBe(1)
  })
})

describe('sorteio ponderado', () => {
  test('erros e lentidão aumentam o peso; dominadas pesam pouco', () => {
    const fresh = itemWeight(undefined, 'buttons')
    const mastered = itemWeight(withAttempts('E5', good(10)), 'buttons')
    const bad = itemWeight(withAttempts('E5', [['wrong', 1], ['wrong', 1], ['correct', 1], ['wrong', 1], ['wrong', 1], ['correct', 1]]), 'buttons')
    const slow = itemWeight(withAttempts('E5', good(6, 3.5)), 'buttons')
    const quick = itemWeight(withAttempts('E5', good(6, 2.1)), 'buttons')
    expect(mastered).toBeGreaterThan(0)
    expect(mastered).toBeLessThan(fresh)
    expect(bad).toBeGreaterThan(fresh)
    expect(slow).toBeGreaterThan(quick)
  })

  test('não repete a mesma nota seguida', () => {
    const rng = seeded(42)
    const stats = new Map<string, ItemStats>()
    let last: string | null = null
    for (let i = 0; i < 500; i++) {
      const next = pickNext(['E5', 'F5', 'G5'], stats, 'buttons', last, rng)
      expect(next).not.toBe(last)
      last = next
    }
    expect(pickNext(['E5'], stats, 'buttons', 'E5', rng)).toBe('E5')
  })

  test('nota fraca sai mais que a dominada, mas a dominada continua aparecendo', () => {
    const rng = seeded(7)
    const stats = new Map<string, ItemStats>([
      ['E5', withAttempts('E5', good(10))],
      ['F5', withAttempts('F5', [['wrong', 3], ['wrong', 3], ['correct', 3], ['wrong', 3]])],
      ['G5', withAttempts('G5', good(10))],
    ])
    const counts: Record<string, number> = { E5: 0, F5: 0, G5: 0 }
    let last: string | null = null
    for (let i = 0; i < 3000; i++) {
      last = pickNext(['E5', 'F5', 'G5'], stats, 'buttons', last, rng)
      counts[last]++
    }
    expect(counts.F5).toBeGreaterThan(counts.E5)
    expect(counts.F5).toBeGreaterThan(counts.G5)
    expect(counts.E5).toBeGreaterThan(100)
  })
})

describe('desbloqueio progressivo', () => {
  const naturals = unlockOrder(scaleItems('solta', false))
  const withAcc = unlockOrder(scaleItems('solta', true))

  test('começa com poucas notas (as primeiras da ordem)', () => {
    const { state, newlyUnlocked } = updateUnlocks(naturals, EMPTY_UNLOCK, new Map(), 'buttons')
    expect(state.unlocked).toEqual(['E5', 'F5', 'G5'])
    expect(newlyUnlocked).toHaveLength(ADAPTIVE.initialActive)
  })

  test('libera a próxima só quando todas as ativas estão dominadas', () => {
    let { state } = updateUnlocks(naturals, EMPTY_UNLOCK, new Map(), 'buttons')
    const stats = new Map<string, ItemStats>([
      ['E5', withAttempts('E5', good(10))],
      ['F5', withAttempts('F5', good(10))],
      ['G5', withAttempts('G5', good(2))],
    ])
    let up = updateUnlocks(naturals, state, stats, 'buttons')
    expect(up.newlyUnlocked).toEqual([])
    expect(up.state.retired.sort()).toEqual(['E5', 'F5'])

    stats.set('G5', withAttempts('G5', good(10)))
    up = updateUnlocks(naturals, up.state, stats, 'buttons')
    expect(up.newlyUnlocked).toEqual(['B4'])
    state = up.state
    // só uma por vez: B4 ainda não dominada
    expect(updateUnlocks(naturals, state, stats, 'buttons').newlyUnlocked).toEqual([])
  })

  test('nota que perde domínio não trava as outras nem volta a ter rótulo', () => {
    const stats = new Map<string, ItemStats>([['E5', withAttempts('E5', good(10))]])
    let state = updateUnlocks(naturals, EMPTY_UNLOCK, stats, 'buttons').state
    expect(state.retired).toContain('E5')
    stats.set('E5', withAttempts('E5', [...good(6), ['wrong', 1], ['wrong', 1], ['wrong', 1], ['wrong', 1]]))
    state = updateUnlocks(naturals, state, stats, 'buttons').state
    expect(state.unlocked).toContain('E5')
    expect(state.retired).toContain('E5')
  })

  test('acidentes entram depois das naturais vizinhas ativas estarem dominadas', () => {
    const stats = new Map<string, ItemStats>()
    let state = EMPTY_UNLOCK
    const unlockedSeq: string[] = []
    for (let step = 0; step < 60; step++) {
      const up = updateUnlocks(withAcc, state, stats, 'buttons')
      unlockedSeq.push(...up.newlyUnlocked)
      state = up.state
      for (const id of state.unlocked) stats.set(id, withAttempts(id, good(10)))
    }
    expect(unlockedSeq).toHaveLength(withAcc.length)
    // E5 F5 G5 iniciais; F#5/Gb5 (entre F5 e G5) entram antes da próxima natural
    expect(unlockedSeq.slice(0, 5)).toEqual(['E5', 'F5', 'G5', 'F#5', 'Gb5'])
    for (const item of withAcc.filter((i) => !i.natural)) {
      const idx = unlockedSeq.indexOf(item.id)
      const neighbours = withAcc.filter((n) => n.natural && Math.abs(n.midi - item.midi) === 1)
      for (const n of neighbours) expect(unlockedSeq.indexOf(n.id)).toBeLessThan(idx)
    }
  })

  test('desligar acidentes tira-os do conjunto ativo sem perder o progresso', () => {
    const state = { unlocked: ['E5', 'F5', 'G5', 'F#5'], retired: [] }
    expect(activeItems(naturals, state).map((i) => i.id)).toEqual(['E5', 'F5', 'G5'])
    expect(activeItems(withAcc, state).map((i) => i.id)).toContain('F#5')
  })
})
