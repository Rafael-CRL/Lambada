import { describe, expect, test, vi } from 'vitest'
import { LESSON } from '../config'

// relógio de áudio controlado pelo teste
let now = 100
vi.mock('../audio/clock', () => ({ audioContext: () => ({}), clock: () => now, outputLatency: () => 0 }))
vi.mock('../audio/synth', () => ({ playNote: () => {} }))
vi.stubGlobal('window', globalThis)
vi.stubGlobal('requestAnimationFrame', () => 0)
vi.stubGlobal('cancelAnimationFrame', () => {})

const { LessonController } = await import('./controller')
const { lesson } = await import('./lessons')
const { noteId } = await import('../domain/notes')
type Note = Parameters<typeof noteId>[0]
type Card = { title: string } | null
type Result = { correct: number; attempts: number; meanTime?: number }

class FakeNote {
  state: string | null = null
  label = ''
  g = { classList: { add: () => {} } }
  constructor(readonly note: Note) {}
  setX() {}
  setState(s: string | null) {
    this.state = s
  }
  setLabel(t: string) {
    this.label = t
  }
  remove() {}
}

function setup(id: Parameters<typeof lesson>[0]) {
  const notes: FakeNote[] = []
  const shown: [number, number | null][] = []
  let card: Card = null
  let result: Result | null = null
  const c = new LessonController({
    lesson: lesson(id),
    stage: {
      width: 400,
      hitNoteX: 100,
      addNote: ((note: Note) => {
        const n = new FakeNote(note)
        notes.push(n)
        return n
      }) as never,
    },
    guide: { show: (base, on) => void shown.push([base, on]) },
    timbre: () => 'off',
    setHud: () => {},
    setCard: (k) => (card = k),
    finish: (r) => (result = r),
    rng: () => 0.3,
  })
  c.start()
  const head = () => c.target!
  const tick = (s: number) => {
    now += s
    c.update(now, s)
  }
  // um quadro antes de cada resposta, como no app
  const right = () => (tick(0.02), c.answerButton({ letter: head().letter, acc: 0 }, 0))
  const wrong = () => (tick(0.02), c.answerButton({ letter: head().letter === 'C' ? 'D' : 'C', acc: 0 }, 0))
  /** responde certo até o fim (fechando os cartões) */
  const finishAll = () => {
    for (let guard = 0; c.target && guard < 300; guard++) {
      right()
      tick(0.5)
    }
    tick(1)
  }
  return { c, notes, shown, head, right, wrong, tick, finishAll, card: () => card, result: () => result }
}

describe('lição', () => {
  test('cartão entre as partes: a tecla só fecha o cartão', () => {
    const t = setup('linhas-1')
    for (let i = 0; i < 2 * LESSON.introRepeat; i++) expect(t.right()).toBe('correct')
    expect(t.card()?.title).toBe('agora em ordem')
    const answered = t.c.answered
    expect(t.right()).toBeNull()
    expect(t.card()).toBeNull()
    expect(t.c.answered).toBe(answered)
    expect(t.right()).toBe('correct')
  })

  test('erro mostra o nome, espera e segue para a próxima', () => {
    const t = setup('linhas-4')
    const n = t.notes.find((x) => x.note === t.head())!
    expect(t.wrong()).toBe('wrong')
    expect(n.state).toBe('err')
    expect(n.label).not.toBe('')
    // durante a espera, respostas são ignoradas
    expect(t.right()).toBeNull()
    t.tick(LESSON.revealTime + 0.05)
    expect(t.c.answered).toBe(1)
    expect(t.right()).toBe('correct')
  })

  test('no sorteio, a nota errada volta depois, com a cola acesa só nela', () => {
    const t = setup('linhas-4')
    // passa o padrão, fecha o cartão e erra a primeira do sorteio
    while (!t.card()) t.right()
    t.right()
    const total = t.c.total
    const missed = t.head()
    t.wrong()
    expect(t.c.total).toBe(total + 1)
    t.tick(LESSON.revealTime + 0.05)
    for (let i = 0; i < LESSON.retryAfter; i++) t.right()
    t.tick(0.5)
    expect(noteId(t.head())).toBe(noteId(missed))
    expect(t.shown.at(-1)).toEqual([0, expect.any(Number)])
  })

  test('termina com acertos e tentativas das notas sem nome', () => {
    const t = setup('linhas-1')
    t.finishAll()
    const r = t.result()!
    expect(r.attempts).toBe(t.c.total - 2 * LESSON.introRepeat)
    expect(r.correct).toBe(r.attempts)
    expect(r.meanTime).toBeUndefined()
  })

  test('Desafio: abre com o cartão e mede o tempo por nota', () => {
    const t = setup('linhas-5')
    expect(t.card()?.title).toBe('Desafio')
    t.finishAll()
    const r = t.result()!
    expect(r.attempts).toBe(LESSON.challengeNotes)
    // cada resposta veio ~0,5 s depois da anterior
    expect(r.meanTime).toBeGreaterThan(0.4)
    expect(r.meanTime).toBeLessThan(0.6)
  })

  test('treinar mais: novas notas sem ajuda na mesma lição', () => {
    const t = setup('linhas-1')
    t.finishAll()
    const before = t.c.total
    t.c.more()
    expect(t.c.total).toBe(before + LESSON.moreNotes)
    expect(t.c.target).not.toBeNull()
    t.finishAll()
    expect(t.result()!.attempts).toBe(t.c.total - 2 * LESSON.introRepeat)
  })
})
