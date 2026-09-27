import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test } from 'vitest'
import { db } from '../db/db'
import { buildConfig } from '../exercises/types'
import { StudySession } from './session'

const config = buildConfig('reading', undefined, 'solta')

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('sessão', () => {
  test('persiste estatísticas e o registro da sessão; toda a região disponível', async () => {
    const s = await StudySession.open(config, 'solta', false)
    expect(s.active).toHaveLength(17)

    const seen = new Set<string>()
    for (let i = 0; i < 34; i++) {
      const item = s.next()
      seen.add(item.id)
      expect(s.record(item.id, 'correct', 0.8)).toEqual([])
    }
    // saco embaralhado: 34 notas = duas rodadas completas
    expect(seen.size).toBe(17)

    const rec = await s.finish(true)
    expect(rec?.attempts).toBe(34)
    expect(rec?.correct).toBe(34)
    expect(rec?.medianTime).toBeCloseTo(0.8)
    expect(await db.sessions.count()).toBe(1)
    expect((await db.itemStats.get('buttons:E5'))?.correct).toBeGreaterThan(0)
  })

  test('estatísticas separadas por entrada', async () => {
    const buttons = await StudySession.open(config, 'solta', false)
    buttons.record('E5', 'wrong', 1)
    await buttons.finish(true)
    const mic = await StudySession.open(buildConfig('notes', undefined, 'solta'), 'solta', false)
    expect(mic.statsOf('E5')).toBeUndefined()
    mic.record('E5', 'wrong-octave', 2)
    const rec = await mic.finish(true)
    expect(rec?.wrongOctave).toBe(1)
    expect((await db.itemStats.get('mic:E5'))?.wrongOctave).toBe(1)
    expect((await db.itemStats.get('buttons:E5'))?.wrong).toBe(1)
  })

  test('sessão vazia não é salva', async () => {
    const s = await StudySession.open(config, 'fechada', true)
    expect(await s.finish(true)).toBeNull()
    expect(await db.sessions.count()).toBe(0)
  })
})
