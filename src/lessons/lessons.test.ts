import { describe, expect, test } from 'vitest'
import { LESSON } from '../config'
import { noteId, parseNote } from '../domain/notes'
import { inStaffRange, staffStep } from '../domain/staff'
import { LESSONS, lessonNotes, lessonSteps, lesson, mixSequence, nextLesson, passes, placeName, reviewNotes, STAGES, stageLessons, upDown } from './lessons'

/** rng determinístico (LCG) */
function seeded(seed = 1) {
  let s = seed
  return () => (s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32
}

const ids = (xs: { note: Parameters<typeof noteId>[0] }[]) => xs.map((x) => noteId(x.note))

describe('trilha', () => {
  test('3 etapas com 5 lições cada, em ordem', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['linhas', 'espacos', 'suplementares'])
    for (const s of STAGES) expect(stageLessons(s.id)).toHaveLength(5)
    expect(nextLesson('linhas-5')?.id).toBe('espacos-1')
    expect(nextLesson('suplementares-5')).toBeNull()
  })

  test('todas as notas cabem na pauta (Mi3 a Mi6) e são naturais', () => {
    for (const l of LESSONS) for (const n of lessonNotes(l)) {
      expect(inStaffRange(n)).toBe(true)
      expect(n.acc).toBe(0)
    }
  })

  test('linhas só têm linhas e espaços só espaços (até misturar)', () => {
    for (const l of stageLessons('linhas')) for (const n of lessonNotes(l)) expect(staffStep(n) % 2).toBe(0)
    for (const l of stageLessons('espacos').slice(0, 3)) for (const n of lessonNotes(l)) expect(Math.abs(staffStep(n) % 2)).toBe(1)
  })

  test('uma lição tem umas 20 notas', () => {
    for (const l of LESSONS) {
      const n = lessonSteps(l, seeded()).length
      expect(n).toBeGreaterThanOrEqual(15)
      expect(n).toBeLessThanOrEqual(30)
    }
  })
})

describe('sequência da lição', () => {
  test('apresenta cada nota nova repetida, com o nome e a cola', () => {
    const steps = lessonSteps(LESSONS[0], seeded())
    const intro = steps.filter((s) => s.part === 'intro')
    expect(ids(intro)).toEqual([...Array(LESSON.introRepeat).fill('E4'), ...Array(LESSON.introRepeat).fill('G4')])
    expect(intro.every((s) => s.name && s.guide === 1)).toBe(true)
    expect(intro.filter((s) => s.isNew).map((s) => noteId(s.note))).toEqual(['E4', 'G4'])
  })

  test('depois o padrão em ordem (cola fraca) e o sorteio (sem ajuda)', () => {
    const steps = lessonSteps(LESSONS[2], seeded())
    const pattern = steps.filter((s) => s.part === 'pattern')
    expect(ids(pattern)).toEqual(['E4', 'G4', 'B4', 'D5', 'F5', 'D5', 'B4', 'G4', 'E4'])
    expect(pattern.every((s) => !s.name && s.guide === LESSON.patternGuide)).toBe(true)
    const mix = steps.filter((s) => s.part === 'mix')
    expect(mix.every((s) => !s.name && s.guide === 0)).toBe(true)
    const order = steps.map((s) => ['intro', 'pattern', 'mix'].indexOf(s.part))
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  test('lição sem ajuda não mostra a cola', () => {
    const l = LESSONS.find((x) => x.id === 'linhas-5')!
    expect(lessonSteps(l, seeded()).every((s) => s.guide === 0)).toBe(true)
  })

  test('suplementares inferiores descem do Mi ao Mi grave', () => {
    const l = LESSONS.find((x) => x.id === 'suplementares-2')!
    const pattern = lessonSteps(l, seeded()).filter((s) => s.part === 'pattern')
    expect(ids(pattern)).toEqual(['E4', 'D4', 'C4', 'B3', 'A3', 'G3', 'F3', 'E3'])
  })

  test('upDown sobe e volta sem repetir o topo', () => {
    expect(upDown(['a', 'b', 'c'])).toEqual(['a', 'b', 'c', 'b', 'a'])
  })
})

describe('sorteio da lição', () => {
  test('com 3 ou mais notas, nunca a mesma duas vezes seguidas', () => {
    for (let seed = 1; seed < 30; seed++) {
      const seq = mixSequence(['E4', 'G4', 'B4'], 30, seeded(seed), ['B4'])
      expect(seq[0]).not.toBe('B4')
      for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1])
    }
  })

  test('com 2 notas, no máximo duas seguidas (e não só alternando)', () => {
    let repeats = 0
    for (let seed = 1; seed < 30; seed++) {
      const seq = mixSequence(['E4', 'G4'], 20, seeded(seed))
      for (let i = 2; i < seq.length; i++) expect(seq[i] === seq[i - 1] && seq[i] === seq[i - 2]).toBe(false)
      for (let i = 1; i < seq.length; i++) if (seq[i] === seq[i - 1]) repeats++
    }
    expect(repeats).toBeGreaterThan(0)
  })

  test('todas as notas saem antes de repetir', () => {
    const pool = ['E4', 'G4', 'B4', 'D5', 'F5']
    const seq = mixSequence(pool, 5, seeded(7))
    expect([...seq].sort()).toEqual([...pool].sort())
  })
})

test('nome do lugar de cada nota', () => {
  const place = (id: string) => placeName(staffStep(parseNote(id)))
  expect(place('E4')).toBe('1ª linha')
  expect(place('F4')).toBe('1º espaço')
  expect(place('F5')).toBe('5ª linha')
  expect(place('E5')).toBe('4º espaço')
  expect(place('D4')).toBe('logo abaixo da pauta')
  expect(place('C4')).toBe('1ª suplementar inferior')
  expect(place('B3')).toBe('abaixo da 1ª suplementar')
  expect(place('G5')).toBe('logo acima da pauta')
  expect(place('A5')).toBe('1ª suplementar superior')
  expect(place('E6')).toBe('3ª suplementar superior')
})

describe('estratégia da trilha', () => {
  test('Mi da 1ª linha e Mi/Fá de cima são referência: no padrão, fora do sorteio', () => {
    for (const id of ['suplementares-1', 'suplementares-2'] as const) {
      expect(lesson(id).pool).not.toContain('E4')
      expect(ids(lessonSteps(lesson(id), seeded()).filter((s) => s.part === 'pattern'))[0]).toBe('E4')
    }
    for (const id of ['suplementares-3', 'suplementares-4'] as const) {
      expect(lesson(id).pool).not.toContain('E5')
      expect(lesson(id).pool).not.toContain('F5')
    }
  })

  test('cartão no começo de cada parte (menos a primeira)', () => {
    const steps = lessonSteps(lesson('linhas-3'), seeded())
    const cards = steps.map((s, i) => [i, s.card?.title] as const).filter(([, c]) => c)
    expect(cards.map(([, c]) => c)).toEqual(['agora em ordem', 'agora sozinho'])
    for (const [i] of cards) expect(steps[i].part).not.toBe(steps[i - 1].part)
    expect(steps[0].card).toBeUndefined()
  })

  test('Desafio: 20 notas com tempo, cartão logo no começo', () => {
    for (const s of STAGES) {
      const d = stageLessons(s.id)[4]
      expect(d.challenge).toBe(true)
      const mix = lessonSteps(d, seeded()).filter((x) => x.part === 'mix')
      expect(mix).toHaveLength(LESSON.challengeNotes)
      expect(mix.every((x) => x.timed)).toBe(true)
      expect(mix[0].card?.title).toBe('Desafio')
    }
  })

  test('Desafio passa com acerto e tempo', () => {
    const d = lesson('linhas-5')
    expect(passes(d, { correct: 19, attempts: 20, meanTime: 1.5 })).toBe(true)
    expect(passes(d, { correct: 19, attempts: 20, meanTime: 2.5 })).toBe(false)
    expect(passes(d, { correct: 15, attempts: 20, meanTime: 1 })).toBe(false)
    expect(passes(lesson('linhas-1'), { correct: 19, attempts: 20 })).toBe(true)
  })

  test('o sorteio revisa as etapas anteriores, espalhado', () => {
    expect(reviewNotes(lesson('linhas-2'))).toEqual([])
    const review = reviewNotes(lesson('espacos-1'))
    expect(review).toEqual(['E4', 'G4', 'B4', 'D5', 'F5'])
    // Linhas e espaços já têm as linhas no sorteio: nada a revisar
    expect(reviewNotes(lesson('espacos-4'))).toEqual([])
    for (let seed = 1; seed < 20; seed++) {
      const mix = ids(lessonSteps(lesson('espacos-1'), seeded(seed)).filter((s) => s.part === 'mix'))
      const isReview = mix.map((id) => review.includes(id))
      expect(isReview.filter(Boolean)).toHaveLength(Math.round(10 * LESSON.review))
      for (let i = 1; i < mix.length; i++) expect(isReview[i] && isReview[i - 1]).toBe(false)
    }
  })
})
