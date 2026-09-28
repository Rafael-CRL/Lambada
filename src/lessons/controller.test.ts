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
const { lesson, reviewFor } = await import('./curriculum')
const { noteId, midiOf } = await import('../domain/notes')
type Note = Parameters<typeof noteId>[0]
type Card = { title: string } | null
type Result = { correct: number; attempts: number; meanTime?: number }
type NotesBody = Extract<ReturnType<typeof lesson>['segments'][number], { kind: 'notes' }>

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

function setup(id: string, mic = false) {
  const def = lesson(id)
  const body = def.segments.find((s): s is NotesBody => s.kind === 'notes')!
  const notes: FakeNote[] = []
  const shown: [number, number | null][] = []
  const events: { type: 'note'; midi: number; onsetTime: number }[] = []
  let card: Card = null
  let fret: unknown = null
  let tip: string | null = null
  let bars = 0
  let result: Result | null = null
  const c = new LessonController({
    lesson: { body, challenge: def.challenge, review: reviewFor(def, body) },
    stage: {
      width: 400,
      hitNoteX: 100,
      addNote: ((note: Note) => {
        const n = new FakeNote(note)
        notes.push(n)
        return n
      }) as never,
      addShapes: (() => {
        bars++
        return new FakeNote(null as never)
      }) as never,
    },
    guide: { show: (base, on) => void shown.push([base, on]) },
    timbre: () => 'off',
    setHud: () => {},
    setCard: (k) => (card = k),
    finish: (r) => (result = r),
    mic: mic ? { poll: () => events.splice(0) as never } : null,
    setFret: (f) => (fret = f),
    setTip: (t) => (tip = t),
    rng: () => 0.3,
  })
  c.start()
  const head = () => c.target!
  const tick = (s: number) => {
    now += s
    c.update(now, s)
  }
  // um quadro antes de cada resposta, como no app
  const right = () => (tick(0.02), c.answerButton({ letter: head().letter, acc: head().acc }, 0))
  const wrong = () => (tick(0.02), c.answerButton({ letter: head().letter === 'C' ? 'D' : 'C', acc: 0 }, 0))
  /** toca uma nota no violão (MIDI escrito) e roda um quadro */
  const play = (writtenMidi: number) => {
    events.push({ type: 'note', midi: writtenMidi - 12, onsetTime: now })
    ;(c as unknown as { frame(p: number): void }).frame(0)
  }
  /** responde certo até o fim (fechando os cartões) */
  const finishAll = () => {
    for (let guard = 0; c.target && guard < 300; guard++) {
      right()
      tick(0.5)
    }
    tick(1)
  }
  return { c, notes, shown, head, right, wrong, play, tick, finishAll, card: () => card, fret: () => fret, tip: () => tip, bars: () => bars, result: () => result }
}

describe('lição de notas', () => {
  test('cartão entre as partes: a tecla só fecha o cartão', () => {
    const t = setup('notas-2')
    for (let i = 0; i < 2; i++) expect(t.right()).toBe('correct')
    expect(t.card()?.title).toBe('agora em ordem')
    const answered = t.c.answered
    expect(t.right()).toBeNull()
    expect(t.card()).toBeNull()
    expect(t.c.answered).toBe(answered)
    expect(t.right()).toBe('correct')
  })

  test('erro mostra o nome, espera e segue para a próxima', () => {
    const t = setup('notas-3')
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
    const t = setup('notas-3')
    while (t.card()?.title !== 'agora sozinho') t.right()
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
    const t = setup('notas-1')
    t.finishAll()
    const r = t.result()!
    expect(r.attempts).toBe(t.c.total - 3)
    expect(r.correct).toBe(r.attempts)
    expect(r.meanTime).toBeUndefined()
  })

  test('Desafio: abre com o cartão e mede o tempo por nota', () => {
    const t = setup('notas-5')
    expect(t.card()?.title).toBe('Desafio')
    t.finishAll()
    const r = t.result()!
    expect(r.attempts).toBe(LESSON.challengeNotes)
    expect(r.meanTime).toBeGreaterThan(0.4)
    expect(r.meanTime).toBeLessThan(0.6)
  })

  test('treinar mais: novas notas sem ajuda na mesma lição', () => {
    const t = setup('notas-1')
    t.finishAll()
    const before = t.c.total
    t.c.more()
    expect(t.c.total).toBe(before + LESSON.moreNotes)
    t.finishAll()
    expect(t.result()!.attempts).toBe(t.c.total - 3)
  })

  test('dica: dois erros seguidos no sorteio mostram a regra; some depois de algumas respostas', () => {
    const t = setup('notas-1')
    while (t.card()?.title !== 'agora sozinho') t.right()
    t.right()
    t.wrong()
    t.tick(LESSON.revealTime + 0.05)
    expect(t.tip()).toBeNull()
    t.wrong()
    expect(t.tip()).toMatch(/^Lembre-se/)
    t.tick(LESSON.revealTime + 0.05)
    for (let i = 0; i < LESSON.tipLasts; i++) {
      expect(t.tip()).not.toBeNull()
      t.right()
      t.tick(0.5)
    }
    expect(t.tip()).toBeNull()
  })

  test('dica: nada no Desafio', () => {
    const t = setup('notas-5')
    t.right()
    for (let i = 0; i < 4; i++) {
      t.wrong()
      t.tick(LESSON.revealTime + 0.05)
    }
    expect(t.tip()).toBeNull()
  })

  test('depois de um erro, a cola volta fraca e apaga nota a nota', () => {
    const t = setup('notas-3')
    while (t.card()?.title !== 'agora sozinho') t.right()
    for (let i = 0; i < LESSON.fadeNotes + 1; i++) t.right()
    t.tick(0.5)
    expect(t.shown.at(-1)![0]).toBe(0)
    t.wrong()
    t.tick(LESSON.revealTime + 0.05)
    const after: number[] = []
    for (let i = 0; i < LESSON.supportNotes + 1; i++) {
      after.push(t.shown.at(-1)![0])
      t.right()
      t.tick(0.5)
    }
    expect(after[0]).toBeCloseTo(LESSON.supportGuide)
    expect(after[1]).toBeLessThan(after[0])
    expect(after.at(-1)).toBe(0)
  })

  test('ver a cola: acende tudo, a nota não conta e volta depois', () => {
    const t = setup('notas-3')
    while (t.card()?.title !== 'agora sozinho') t.right()
    t.c.dismissCard()
    t.tick(0.02)
    const total = t.c.total
    const helped = t.head()
    t.c.help()
    expect(t.shown.at(-1)).toEqual([1, null])
    t.right()
    expect(t.c.total).toBe(total + 1)
    t.finishAll()
    const r = t.result()!
    expect(r.attempts).toBe(r.correct)
    // fora a apresentação (2), só a nota ajudada não conta
    expect(r.attempts).toBe(t.c.total - 2 - 1)
    expect(t.notes.filter((n) => noteId(n.note) === noteId(helped)).length).toBeGreaterThan(1)
  })

  test('ver a cola: não existe no Desafio', () => {
    const t = setup('notas-5')
    t.right()
    t.tick(0.02)
    const before = t.shown.length
    t.c.help()
    expect(t.shown.length).toBe(before)
  })

  test('acidentes: barra entre as notas; a nota herdada pede o acidente de antes', () => {
    const t = setup('acidentes-1')
    t.finishAll()
    expect(t.bars()).toBeGreaterThan(10)
    const u = setup('acidentes-3')
    // Fá♯, depois um Fá sem sinal no mesmo compasso: vale Fá♯
    u.tick(0.02)
    expect(noteId(u.head())).toBe('F#4')
    u.right()
    u.tick(0.5)
    expect(noteId(u.head())).toBe('F#4')
    expect(u.notes.find((n) => n.note.letter === 'F' && n.note.acc === 0)).toBeDefined()
  })

  test('violão: o microfone responde; na apresentação o braço mostra onde fica', () => {
    const t = setup('posicao-1', true)
    t.tick(0.02)
    expect(t.fret()).toMatchObject({ target: { string: 1, fret: 0 } })
    t.play(midiOf(t.head()))
    expect(t.c.answered).toBe(1)
    // oitava errada: mostra o braço com a tocada e espera mais que nos botões
    t.tick(0.02)
    t.play(midiOf(t.head()) - 12)
    expect(t.notes.some((n) => n.state === 'oct')).toBe(true)
    expect(t.fret()).toMatchObject({ played: expect.anything() })
    t.tick(LESSON.revealTime + 0.05)
    expect(t.c.answered).toBe(1)
    t.tick(LESSON.revealTimeMic)
    expect(t.c.answered).toBe(2)
  })
})
