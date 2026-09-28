import { describe, expect, test, vi } from 'vitest'

// relógio de áudio controlado pelo teste
let now = 100
vi.mock('../audio/clock', () => ({ audioContext: () => ({ currentTime: now }), clock: () => now, outputLatency: () => 0 }))
const clicks: { base: number; from: number; to: number; meter: number }[] = []
vi.mock('../audio/metronome', () => ({
  Metronome: class {
    constructor(
      readonly bpm: number,
      readonly meter: number,
    ) {}
    start(base: number, from: number, to: number) {
      clicks.push({ base, from, to, meter: this.meter })
    }
    stop() {}
    dispose() {}
  },
}))
const tones: { time: number; dur: number }[] = []
vi.mock('../audio/tones', () => ({
  ToneScheduler: class {
    schedule(time: number, dur: number) {
      tones.push({ time, dur })
    }
    stop() {}
    dispose() {}
  },
}))
vi.stubGlobal('requestAnimationFrame', () => 0)
vi.stubGlobal('cancelAnimationFrame', () => {})

const { RHYTHM } = await import('../config')
const { TapJudge } = await import('./judge')
const { makePattern, onsets, patternBeats, placed, signature } = await import('./patterns')
const { rhythmItems, cellValue, beatsLabel } = await import('./items')
const { RhythmController } = await import('./controller')
const { barBeats } = await import('../domain/rhythm')
type Body = Parameters<typeof rhythmItems>[0]
type View = Parameters<ConstructorParameters<typeof RhythmController>[0]['setView']>[0]

function seeded(seed = 3) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
}

describe('juiz das batidas', () => {
  test('casa cada batida com o ataque mais próximo dentro da tolerância', () => {
    const j = new TapJudge([1, 2, 3], 0.1)
    expect(j.tap(1.05)).toBe(0)
    expect(j.tap(2.5)).toBeNull()
    expect(j.tap(2.96)).toBe(2)
    expect(j.missedBy(2.2)).toEqual([1])
    expect(j.score).toEqual({ correct: 1, attempts: 3 })
    expect(j.perfect).toBe(false)
  })

  test('duas batidas no mesmo ataque: a segunda é a mais', () => {
    const j = new TapJudge([1], 0.1)
    j.tap(1)
    expect(j.tap(1.02)).toBeNull()
    expect(j.extras).toHaveLength(1)
  })
})

describe('trechos', () => {
  test('cada trecho tem a figura obrigatória e não repete o anterior', () => {
    const rng = seeded()
    let last: string | undefined
    for (let k = 0; k < 50; k++) {
      const p = makePattern({ cells: ['q', 'h'], must: ['h'] }, 4, 2, rng, last)
      expect(p.bars.flat().some((e) => e.figure === 'half')).toBe(true)
      expect(signature(p)).not.toBe(last)
      for (const bar of p.bars) expect(barBeats(bar)).toBe(4)
      last = signature(p)
    }
  })

  test('posições absolutas e ataques', () => {
    const p = { meter: 3 as const, bars: [[{ figure: 'half' as const, rest: false, beatInBar: 0 }, { figure: 'quarter' as const, rest: true, beatInBar: 2 }], [{ figure: 'quarter' as const, rest: false, beatInBar: 0 }, { figure: 'half' as const, rest: false, beatInBar: 1 }]] }
    expect(placed(p).map((e) => e.beat)).toEqual([0, 2, 3, 4])
    expect(onsets(p).map((e) => e.beat)).toEqual([0, 3, 4])
    expect(patternBeats(p)).toBe(6)
  })
})

describe('itens da lição', () => {
  const body: Body = {
    kind: 'rhythm',
    cells: ['q', 'h', 'w'],
    focus: ['w'],
    parts: [
      { mode: 'imitate', count: 2 },
      { mode: 'read', count: 3 },
      { mode: 'write', count: 2 },
      { mode: 'value', count: 4 },
      { mode: 'complete', count: 3 },
    ],
  }

  test('um cartão no começo de cada parte, com a quantidade pedida', () => {
    const items = rhythmItems(body, seeded())
    expect(items.map((i) => i.mode)).toEqual(['imitate', 'imitate', 'read', 'read', 'read', 'write', 'write', 'value', 'value', 'value', 'value', 'complete', 'complete', 'complete'])
    expect(items.filter((i) => i.card).map((i) => i.card!.title)).toEqual(['Ouça e repita', 'Agora leia', 'Ouça e escreva', 'Quantos pulsos?', 'Complete o compasso'])
  })

  test('imitar e escrever em 1 compasso; ler em 2', () => {
    const items = rhythmItems(body, seeded())
    for (const it of items) if (it.mode === 'write' || it.mode === 'imitate') expect(it.pattern.bars).toHaveLength(1)
    for (const it of items) if (it.mode === 'read') expect(it.pattern.bars).toHaveLength(2)
  })

  test('quantos pulsos: opções com o valor certo, sem a mesma figura seguida', () => {
    const items = rhythmItems(body, seeded()).filter((i) => i.mode === 'value')
    for (const it of items) if (it.mode === 'value') expect(it.options).toContain(cellValue(it.cell))
    for (let k = 1; k < items.length; k++) expect((items[k] as { cell: string }).cell).not.toBe((items[k - 1] as { cell: string }).cell)
  })

  test('complete o compasso: o buraco é uma nota e a resposta está nas opções', () => {
    for (const it of rhythmItems(body, seeded(9))) {
      if (it.mode !== 'complete') continue
      const gap = placed(it.pattern)[it.gap]
      expect(gap.rest).toBe(false)
      expect(it.options).toContain(it.answer)
    }
  })

  test('valores em pulsos', () => {
    expect(['q', 'h', 'w', 'dh', 'ee', 'dqe', 'qr'].map((c) => cellValue(c as never))).toEqual([1, 2, 4, 3, 0.5, 1.5, 1])
    expect([0.5, 1, 1.5, 4].map(beatsLabel)).toEqual(['½', '1', '1½', '4'])
  })
})

function setup(body: Body, bpm = 60) {
  let view: View | null = null
  let result: { correct: number; attempts: number } | null = null
  const c = new RhythmController({
    body,
    bpm,
    toleranceMs: 120,
    tapLatencyMs: 0,
    rng: seeded(),
    setView: (v) => (view = v),
    setHud: () => {},
    finish: (r) => (result = r),
  })
  c.start()
  const tick = (s: number) => {
    for (let t = 0; t < s; t += 0.02) {
      now += 0.02
      c.update(now)
    }
  }
  return { c, tick, view: () => view!, result: () => result }
}

describe('controlador de ritmo', () => {
  test('ler: contagem de 1 compasso, batidas certas acendem, trecho perfeito segue', () => {
    const t = setup({ kind: 'rhythm', cells: ['q'], parts: [{ mode: 'read', count: 2 }] })
    expect(t.view().phase).toBe('card')
    t.c.continue()
    expect(t.view().phase).toBe('play')
    const it = t.view().item as { pattern: Parameters<typeof onsets>[0] }
    const start = clicks.at(-1)!.base + 4 * 1
    for (const e of onsets(it.pattern)) {
      now = start + e.beat
      expect(t.c.tap(0)).toBe('ok')
    }
    // o trecho termina depois da tolerância do último pulso
    t.tick(1.3)
    expect(t.view().phase).toBe('result')
    expect(t.view().marks.filter((m) => m === 'ok')).toHaveLength(8)
    t.tick(RHYTHM.resultTime + 0.1)
    expect(t.view().index).toBe(1)
  })

  test('nota perdida fica vermelha, o app toca o certo e o trecho volta depois', () => {
    const t = setup({ kind: 'rhythm', cells: ['q', 'h'], parts: [{ mode: 'read', count: 3 }] })
    t.c.continue()
    const total = t.c.total
    // não bate nada
    t.tick(4 + 8 + 0.5)
    expect(t.view().phase).toBe('result')
    expect(t.view().marks.some((m) => m === 'err')).toBe(true)
    expect(t.c.total).toBe(total + 1)
    tones.length = 0
    t.tick(RHYTHM.resultTime + 0.1)
    // replay: contagem + o trecho tocado
    expect(t.view().phase).toBe('play')
    expect(tones.length).toBeGreaterThan(0)
    t.tick(4 + 8 + 1)
    expect(t.view().index).toBe(1)
  })

  test('imitar: o app toca, conta de novo e aí é a vez do aluno', () => {
    const t = setup({ kind: 'rhythm', cells: ['q'], parts: [{ mode: 'imitate', count: 1 }] })
    tones.length = 0
    t.c.continue()
    expect(tones).toHaveLength(4)
    const base = clicks.at(-1)!.base
    expect(clicks.at(-1)!.to).toBe(4 + 4 + 4 + 4 - 1)
    now = base + 5
    t.c.update(now)
    expect(t.view().turn).toBe('listen')
    // bater durante a escuta não conta
    expect(t.c.tap(0)).toBeNull()
    now = base + 4 + 4 + 4 + 0.01
    t.c.update(now)
    expect(t.view().turn).toBe('tap')
    expect(t.c.tap(0)).toBe('ok')
  })

  test('escrever: a paleta não passa do compasso; conferir compara figura a figura', () => {
    const t = setup({ kind: 'rhythm', cells: ['q', 'h', 'w'], parts: [{ mode: 'write', count: 1 }] })
    t.c.continue()
    expect(t.view().phase).toBe('write')
    const it = t.view().item as { pattern: { bars: { figure: string; rest: boolean }[][] } }
    const cells = it.pattern.bars[0].map((e) => (e.figure === 'quarter' ? 'q' : e.figure === 'half' ? 'h' : 'w'))
    expect(t.c.addCell('w')).toBe(true)
    t.c.erase()
    expect(t.view().written[0]).toEqual([])
    for (const c of cells) expect(t.c.addCell(c as 'q')).toBe(true)
    expect(t.c.fits('q')).toBe(false)
    expect(t.c.addCell('q')).toBe(false)
    t.c.check()
    expect(t.view().writtenOk).toEqual([true])
    t.tick(RHYTHM.resultTime + 0.1)
    expect(t.result()).toEqual({ correct: 1, attempts: 1 })
  })

  test('quantos pulsos: resposta certa soma, a figura soa e segue', () => {
    const t = setup({ kind: 'rhythm', cells: ['q', 'h'], parts: [{ mode: 'value', count: 2 }] })
    t.c.continue()
    expect(t.view().phase).toBe('ask')
    const it = t.view().item as { cell: 'q' | 'h' }
    expect(t.c.choose(cellValue(it.cell))).toBe(true)
    expect(t.view().phase).toBe('answered')
    expect(t.c.choose(1)).toBeNull()
    t.tick(4)
    const it2 = t.view().item as { cell: 'q' | 'h' }
    expect(t.c.choose(cellValue(it2.cell) === 1 ? 2 : 1)).toBe(false)
    t.tick(4)
    expect(t.result()).toEqual({ correct: 1, attempts: 2 })
  })

  test('"?" no meio: para e refaz o trecho ao voltar', () => {
    const t = setup({ kind: 'rhythm', cells: ['q'], parts: [{ mode: 'read', count: 1 }] })
    t.c.continue()
    t.tick(2)
    t.c.pause()
    const n = clicks.length
    t.tick(10)
    expect(t.view().phase).toBe('play')
    t.c.resume()
    expect(clicks.length).toBe(n + 1)
  })
})
