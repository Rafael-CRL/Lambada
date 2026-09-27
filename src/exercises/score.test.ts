import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { BPM } from '../config'

// relógio de áudio controlado pelo teste
let now = 100
vi.mock('../audio/clock', () => ({
  audioContext: () => ({}),
  clock: () => now,
  outputLatency: () => 0,
}))
// metrônomo mudo
vi.mock('../audio/metronome', () => ({
  Metronome: class {
    start() {}
    stop() {}
    dispose() {}
  },
}))
vi.mock('../audio/synth', () => ({ playNote: () => {} }))
vi.stubGlobal('window', globalThis)

const { db, DEFAULT_SETTINGS } = await import('../db/db')
const { StudySession } = await import('../engine/session')
const { ScoreController, multiplierFor, scoreHit } = await import('./score')
const { buildConfig } = await import('./types')
type Opts = Parameters<typeof buildConfig>[1]
type Id = Parameters<typeof buildConfig>[0]

class FakeNote {
  x = 0
  state: string | null = null
  label = ''
  constructor(readonly note: { letter: string; acc: number; octave: number } | null) {}
  setX(x: number) {
    this.x = x
  }
  setState(s: string | null) {
    this.state = s
  }
  setLabel(t: string) {
    this.label = t
  }
  showGhost() {}
  remove() {}
}

function fakeStage() {
  const notes: FakeNote[] = []
  return {
    notes,
    width: 400,
    hitNoteX: 84,
    hitX: 90,
    addNote(note: FakeNote['note']) {
      const n = new FakeNote(note)
      notes.push(n)
      return n
    },
    addShapes() {
      return new FakeNote(null)
    },
  }
}

async function setup(patch: Opts & { activity?: Id } = {}) {
  const config = buildConfig(patch.activity ?? 'reading', patch, 'solta')
  const session = await StudySession.open(config, config.scale, false)
  const stage = fakeStage()
  let finished: unknown = null
  const hud: Record<string, unknown> = {}
  const ctrl = new ScoreController({
    config,
    settings: DEFAULT_SETTINGS,
    session,
    mic: null,
    stage: stage as never,
    setHud: (p) => Object.assign(hud, p),
    finish: (extra) => (finished = extra ?? {}),
  })
  const c = ctrl as unknown as {
    begin(n: number): void
    update(n: number, dt: number): void
    started: boolean
    events: { beat: number; item: { id: string; written: { letter: string; acc: number } } | null; rest: boolean; resolved: boolean }[]
    head?: { item: { written: { letter: 'C'; acc: 0 } } }
    base: number
    spb: number
  }
  c.started = true
  c.begin(now)
  const tick = (seconds: number) => {
    for (let t = 0; t < seconds; t += 0.05) {
      now += 0.05
      c.update(now, 0.05)
    }
  }
  const press = (letter: string, acc = 0) => ctrl.answerButton({ letter: letter as 'C', acc: acc as 0 }, 0)
  const answerHead = () => {
    const h = c.head!.item.written
    return press(h.letter, h.acc)
  }
  return { ctrl, c, stage, hud, tick, press, answerHead, finished: () => finished, session }
}

beforeEach(async () => {
  now = 100
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('pontuação do metrônomo', () => {
  test('nota certa no tempo vale base + precisão', () => {
    expect(scoreHit(0, 0.12, 1)).toBe(BPM.hitPoints + BPM.timingPoints)
    expect(scoreHit(0.06, 0.12, 1)).toBe(BPM.hitPoints + BPM.timingPoints / 2)
    expect(scoreHit(-0.12, 0.12, 1)).toBe(BPM.hitPoints)
  })

  test('multiplicador sobe com o combo até o teto', () => {
    expect(multiplierFor(0)).toBe(1)
    expect(multiplierFor(BPM.comboStep)).toBe(2)
    expect(multiplierFor(1000)).toBe(BPM.maxMultiplier)
  })
})

describe('tempo livre', () => {
  test('a nota espera a resposta; erro não avança, acerto avança', async () => {
    const { c, press, answerHead, tick } = await setup({})
    tick(1)
    const first = c.head!
    const wrong = first.item.written.letter === 'C' ? 'D' : 'C'
    expect(press(wrong)).toBe('wrong')
    expect(c.head).toBe(first)
    expect(answerHead()).toBe('correct')
    expect(c.head).not.toBe(first)
  })

  test('8 compassos = 32 notas em compassos de 4 semínimas, depois termina', async () => {
    const { c, answerHead, tick, finished, hud } = await setup({ duration: 'short' })
    for (let i = 0; i < 32; i++) {
      tick(0.3)
      expect(answerHead()).toBe('correct')
    }
    tick(1)
    expect(finished()).not.toBeNull()
    expect(hud.progressText).toBe('8/8')
    expect(c.events.every((e) => !e.rest)).toBe(true)
  })

  test('60 s termina pelo tempo', async () => {
    const { tick, answerHead, finished } = await setup({ duration: 'timed' })
    for (let i = 0; i < 20; i++) {
      tick(1)
      answerHead()
    }
    expect(finished()).toBeNull()
    tick(41)
    expect(finished()).not.toBeNull()
  })

  test('escala toca a sequência inteira (sobe e desce) e acaba', async () => {
    const { c, tick, answerHead, finished } = await setup({ activity: 'scale' })
    const played: string[] = []
    for (let i = 0; i < 100; i++) {
      tick(0.3)
      if (!c.head) break
      played.push(c.head.item.written.letter)
      answerHead()
    }
    // Solta, naturais: 17 subindo + 16 descendo
    expect(played).toHaveLength(33)
    expect(played[0]).toBe('E')
    expect(played.at(-1)).toBe('E')
    tick(1)
    expect(finished()).not.toBeNull()
  })

  test('∞ (padrão) não termina sozinho e não mostra barra de progresso', async () => {
    const { tick, answerHead, finished, hud } = await setup({})
    for (let i = 0; i < 80; i++) {
      tick(0.3)
      answerHead()
    }
    expect(finished()).toBeNull()
    expect(hud.progress).toBeNull()
  })

  test('♯♭ ligados no meio valem para as próximas notas', async () => {
    const { session } = await setup({})
    expect(session.items.some((i) => !i.natural)).toBe(false)
    session.setAccidentals(true)
    expect(session.items.some((i) => !i.natural)).toBe(true)
  })

  test('repetição percorre todas as notas da região, uma por compasso, e termina', async () => {
    const { c, tick, finished } = await setup({ activity: 'repeat' })
    const seen: string[] = []
    for (let i = 0; i < 2000 && !finished(); i++) {
      tick(0.25)
      for (const e of c.events) if (!e.resolved && e.item) seen.push(e.item.id)
      // deixa o metrônomo passar sem tocar: as notas viram erro e a sessão anda
    }
    expect(finished()).not.toBeNull()
    // Solta, naturais: 17 notas, começando pela 1ª corda (Mi, Fá, Sol escritos na 5ª oitava)
    const order = [...new Set(seen)]
    expect(order).toHaveLength(17)
    expect(order.slice(0, 3)).toEqual(['E5', 'F5', 'G5'])
  })

  test('repetição: cada compasso tem 4 vezes a mesma nota', async () => {
    const { c, tick } = await setup({ activity: 'repeat' })
    tick(0.5)
    const bars = new Map<number, Set<string>>()
    for (const e of c.events) {
      const bar = Math.floor(e.beat / 4)
      bars.set(bar, (bars.get(bar) ?? new Set()).add(e.item!.id))
    }
    expect(bars.size).toBeGreaterThan(1)
    for (const ids of bars.values()) expect(ids.size).toBe(1)
  })
})

describe('metrônomo', () => {
  test('toque no tempo pontua; nota não tocada vira erro', async () => {
    const { ctrl, c, tick, hud } = await setup({ tempo: 'metronome', bpm: 120 })
    // antes da contagem terminar nada foi julgado
    tick(0.5)
    expect(hud.countdown).not.toBeNull()
    // vai até o primeiro tempo e acerta
    now = c.base + 0.01
    c.update(now, 0.01)
    const first = c.events[0]
    const w = first.item!.written
    expect(ctrl.answerButton({ letter: w.letter as 'C', acc: w.acc as 0 }, 0)).toBe('correct')
    // deixa o segundo passar
    tick(c.spb + 0.3)
    expect(c.events[1].resolved).toBe(true)
    expect(String(hud.stats && (hud.stats as { value: string }[])[0].value)).not.toBe('0')
  })

  test('com figuras, compassos somam 4 tempos e pausas não são julgadas', async () => {
    const { c, tick } = await setup({ tempo: 'metronome', level: 5, duration: 'long' })
    tick(0.2)
    c.update(now, 0)
    const byBar = new Map<number, number>()
    for (const e of c.events) byBar.set(Math.floor(e.beat / 4), (byBar.get(Math.floor(e.beat / 4)) ?? 0) + 1)
    expect(c.events.filter((e) => e.rest).every((e) => e.resolved)).toBe(true)
    expect(c.events.filter((e) => !e.rest).every((e) => e.item)).toBe(true)
  })
})
