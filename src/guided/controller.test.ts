import { beforeEach, expect, test, vi } from 'vitest'
import type { TrackerEvent } from '../audio/tracker'
import { studyById } from './catalog'
import type { StudyOptions } from './progress'

let now = 100
const scheduled = vi.fn(() => vi.fn())
vi.mock('../audio/clock', () => ({ clock: () => now, audioContext: () => ({ currentTime: now }) }))
vi.mock('../audio/synth', () => ({ scheduleNote: (...args: unknown[]) => scheduled(...args as []) }))
vi.mock('../audio/metronome', () => ({ Metronome: class { start() {} stop() {} dispose() {} } }))
vi.stubGlobal('window', globalThis)
vi.stubGlobal('requestAnimationFrame', () => 1)
vi.stubGlobal('cancelAnimationFrame', () => {})

const { GuidedController } = await import('./controller')
beforeEach(() => { now = 100; scheduled.mockClear() })

function setup(id: string, options: StudyOptions) {
  let pending: TrackerEvent[] = []
  const record = vi.fn()
  const finish = vi.fn()
  const view = vi.fn()
  const controller = new GuidedController({ study: studyById(id)!, options, toleranceMs: 120,
    mic: options.mode === 'mic' ? { poll: () => { const events = pending; pending = []; return events } } as never : null,
    session: { record } as never, onView: view, onFinish: finish,
  })
  controller.start()
  return {
    controller, record, finish, view,
    tick: (t: number) => { now = t; controller.update() },
    play: (midi: number) => {
      pending = [{ type: 'note', midi, freq: 100, cents: 0, time: now, onsetTime: now }]
      controller.update()
    },
  }
}

test('tempo livre: correção não soma outra tentativa; pausa não aceita nota', () => {
  const s = setup('sustenidos-6', { mode: 'mic', tempo: 'free', bpm: 60, loops: 1 })
  s.play(52)
  s.play(40)
  expect(s.record).toHaveBeenCalledTimes(1)
  expect(s.controller.judge.next).toBe(1)
  s.controller.pause()
  s.play(41)
  s.controller.resume()
  expect(s.record).toHaveBeenCalledTimes(1)
  for (const midi of [41, 42, 43, 44]) s.play(midi)
  expect(s.finish).toHaveBeenCalledTimes(1)
  expect(s.controller.judge.attempts).toBe(5)
  expect(s.controller.judge.correct).toBe(4)
  s.controller.dispose()
})

test('200 bpm: aguarda a janela do último ataque e registra todas as notas perdidas', () => {
  const s = setup('sustenidos-6', { mode: 'mic', tempo: 'metronome', bpm: 200, loops: 1 })
  // quatro pulsos de contagem + folga; cinco notas de 0,3 s
  const base = 100 + 4 * 0.3 + 0.15
  s.tick(base + 5 * 0.3)
  expect(s.finish).not.toHaveBeenCalled()
  s.tick(base + 5 * 0.3 + 0.1)
  expect(s.finish).toHaveBeenCalledTimes(1)
  expect(s.controller.judge.attempts).toBe(5)
  expect(s.record).toHaveBeenCalledTimes(5)
  s.controller.dispose()
})

test('metrônomo mantém a última nota longa até o fim do compasso', () => {
  const s = setup('corda-6-1', { mode: 'practice', tempo: 'metronome', bpm: 60, loops: 1 })
  s.tick(104.15 + 33)
  expect(s.finish).not.toHaveBeenCalled()
  s.tick(104.15 + 36)
  expect(s.finish).toHaveBeenCalledTimes(1)
  expect(s.record).not.toHaveBeenCalled()
  s.controller.dispose()
})

test('escuta agenda duas vozes e as cancela ao pausar', () => {
  const s = setup('andante', { mode: 'listen', tempo: 'metronome', bpm: 60, loops: 1 })
  s.tick(103.15)
  expect(scheduled.mock.calls.length).toBeGreaterThan(0)
  const stop = scheduled.mock.results.at(-1)!.value
  s.controller.pause()
  expect(stop).toHaveBeenCalled()
  s.tick(110)
  expect(s.finish).not.toHaveBeenCalled()
  s.controller.resume()
  expect(s.record).not.toHaveBeenCalled()
  s.controller.dispose()
})

test('duas voltas contêm toda a forma musical duas vezes', () => {
  const s = setup('poco-andante-2', { mode: 'practice', tempo: 'metronome', bpm: 60, loops: 2 })
  expect(s.controller.totalBeats).toBe(160)
  s.tick(102.15 + 80)
  expect(s.finish).not.toHaveBeenCalled()
  s.tick(102.15 + 160)
  expect(s.finish).toHaveBeenCalledTimes(1)
  s.controller.dispose()
})
