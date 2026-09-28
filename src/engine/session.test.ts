import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test } from 'vitest'
import { db } from '../db/db'
import { buildConfig } from '../exercises/types'
import { STRING_NOTES } from '../lessons/curriculum'
import { sessionItems, StudySession } from './session'

const config = buildConfig('reading', undefined, 'solta')

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('sessão', () => {
  test('persiste estatísticas e o registro da sessão; todas as notas do conjunto', async () => {
    // Leitura: "todas" = do Mi3 ao Mi6 (22 naturais)
    const s = await StudySession.open(config, 'solta', false)
    expect(s.active).toHaveLength(22)

    const seen = new Set<string>()
    for (let i = 0; i < 44; i++) {
      const item = s.next()
      seen.add(item.id)
      expect(s.record(item.id, 'correct', 0.8)).toEqual([])
    }
    // saco embaralhado: 44 notas = duas rodadas completas
    expect(seen.size).toBe(22)

    const rec = await s.finish(true)
    expect(rec?.attempts).toBe(44)
    expect(rec?.correct).toBe(44)
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

  test('Leitura: conjunto de notas; "linhas" guardado vira a pauta', async () => {
    const s = await StudySession.open(buildConfig('reading', { notes: 'linhas' as never }, 'solta'), 'solta', false)
    expect(s.active.map((i) => i.id).sort()).toEqual(['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'].sort())
  })

  test('Leitura: ♯♭ da mesma letra', async () => {
    const s = await StudySession.open(buildConfig('reading', { notes: 'pauta', accidentals: true }, 'solta'), 'solta', true)
    expect(s.active.map((i) => i.id)).toEqual(expect.arrayContaining(['G4', 'G#4', 'Gb4', 'E4', 'Eb4', 'F5', 'F#5']))
    expect(s.active.map((i) => i.id)).not.toContain('E#4')
  })

  test('violão: a região; lições filtram pelas notas da lição', async () => {
    const notes = await StudySession.open(buildConfig('notes', undefined, 'solta'), 'solta', false)
    expect(notes.active).toHaveLength(17)
    const lesson = await StudySession.open({ ...buildConfig('notes', undefined, 'solta'), pool: ['E5', 'F5', 'G5'] }, 'solta', false)
    expect(lesson.active.map((i) => i.id)).toEqual(['E5', 'F5', 'G5'])
  })

  test('sessão vazia não é salva', async () => {
    const s = await StudySession.open(config, 'fechada', true)
    expect(await s.finish(true)).toBeNull()
    expect(await db.sessions.count()).toBe(0)
  })
})

describe('Notas do violão: cordas', () => {
  test('sem escolha, as 17 naturais da 1ª posição; com cordas, só as delas', () => {
    expect(sessionItems(buildConfig('notes', undefined, 'solta'), 'solta', false)).toHaveLength(17)
    const five = sessionItems(buildConfig('notes', { strings: [5] }, 'solta'), 'solta', false)
    expect(five.map((i) => i.id).sort()).toEqual([...STRING_NOTES[5]].sort())
    const bass = sessionItems(buildConfig('notes', { strings: [4, 5, 6] }, 'solta'), 'solta', false)
    expect(bass.map((i) => i.id).sort()).toEqual([4, 5, 6].flatMap((n) => STRING_NOTES[n]).sort())
    // com ♯♭, os acidentes daquelas cordas
    expect(sessionItems(buildConfig('notes', { strings: [1] }, 'solta'), 'solta', true).every((i) => i.position.string === 1)).toBe(true)
  })

  test('cordas guardadas inválidas valem como todas', () => {
    expect(buildConfig('notes', { strings: [] }, 'solta').strings).toEqual([1, 2, 3, 4, 5, 6])
    expect(buildConfig('reading', undefined, 'solta').strings).toBeUndefined()
  })
})
