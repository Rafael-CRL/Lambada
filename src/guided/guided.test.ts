import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test } from 'vitest'
import { db, getLastPlace } from '../db/db'
import { midiAt } from '../domain/fretboard'
import { midiOf, parseNote } from '../domain/notes'
import { FIGURE_BEATS } from '../domain/rhythm'
import { StudySession } from '../engine/session'
import { buildConfig, modeKey } from '../exercises/types'
import { parseHash, routeHash } from '../app/router'
import { STUDIES, studyById, timeline } from './catalog'
import { GuidedJudge } from './judge'
import { loadGuidedProgress, loadStudyOptions, normalizeOptions, saveGuidedResult, saveStudyOptions } from './progress'

beforeEach(async () => { await Promise.all([db.meta.clear(), db.sessions.clear(), db.itemStats.clear()]) })

describe('transcrição do livro, páginas 26–34', () => {
  test('49 práticas: 46 exercícios e as três partituras do repertório', () => {
    expect(STUDIES).toHaveLength(49)
    expect(new Set(STUDIES.map((s) => s.id)).size).toBe(49)
    expect(STUDIES.filter((s) => s.kind === 'piece').map((s) => s.id)).toEqual(['andante', 'poco-andante-2', 'poco-andante-3'])
    expect(STUDIES[0].id).toBe('corda-6-1')
  })
  test('compassos completos, posições corretas e alturas explícitas em toda a transcrição', () => {
    for (const study of STUDIES) {
      for (const bar of study.bars) {
        expect(Math.max(...bar.map((n) => n.beat + FIGURE_BEATS[n.figure])), study.id).toBe(study.meter)
        if (!study.polyphonic) expect(bar.reduce((sum, n) => sum + FIGURE_BEATS[n.figure], 0), study.id).toBe(study.meter)
        for (const n of bar) {
          expect(n.beat).toBeGreaterThanOrEqual(0)
          if (n.note) {
            expect(midiOf(parseNote(n.note)) - 12).toBeGreaterThanOrEqual(40)
            if (n.position) {
              expect(midiAt(n.position), `${study.id}: ${n.note}`).toBe(midiOf(parseNote(n.note)) - 12)
              expect(n.position.fret).toBeGreaterThanOrEqual(0)
              expect(n.position.fret).toBeLessThanOrEqual(4)
            }
          }
        }
      }
      expect(study.order.every((i) => study.bars[i])).toBe(true)
      const notes = timeline(study)
      expect(notes.map((n) => n.at)).toEqual(notes.map((n) => n.at).sort((a, b) => a - b))
      expect(Math.max(...notes.map((n) => n.end))).toBe(study.order.length * study.meter)
    }
  })
  test('ritornelo repete o trecho, mas não a nota final', () => {
    const s = studyById('corda-6-1')!
    expect(s.order).toEqual([0, 1, 2, 3, 0, 1, 2, 3, 4])
    expect(timeline(s).filter((n) => n.note)).toHaveLength(33)
    expect(s.bars.map((b) => b[0].note)).toEqual(['E3', 'F3', 'G3', 'F3', 'E3'])
    expect(studyById('corda-3-2')!.bars).toHaveLength(4)
  })
  test('Andante mantém o baixo longo e o acorde final simultâneo', () => {
    const s = studyById('andante')!
    expect(s.polyphonic).toBe(true)
    expect(s.bars[0].map((n) => n.note)).toEqual(['A3', 'A4', 'B4', 'C5', 'B4', 'A4'])
    expect(s.bars[0][0].figure).toBe('dotted-half')
    expect(s.bars[0].map((n) => n.beat)).toEqual([0, 0.5, 1, 1.5, 2, 2.5])
    expect(s.bars[7].map((n) => [n.note, n.beat, n.figure])).toEqual([['A3', 0, 'dotted-half'], ['A4', 0, 'dotted-half']])
  })
  test('Poco Andante executa A A B B A e termina no Fine nas duas métricas', () => {
    for (const meter of [2, 3]) {
      const s = studyById(`poco-andante-${meter}`)!
      expect(s.order).toHaveLength(40)
      expect(s.order.slice(16, 24)).toEqual([8, 9, 10, 11, 12, 13, 14, 15])
      expect(s.order.slice(-8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
      expect(s.bars[0].filter((n) => n.note === 'C5')).toHaveLength(meter - 1)
      expect(s.bars[7].filter((n) => n.note).map((n) => n.note)).toEqual(['C4'])
    }
  })
  test('bequadros preservam Dó♭ e Fá♭ escritos e a corda indicada', async () => {
    const study = studyById('bequadro-bemol-2')!
    const pool = study.bars[0].map((n) => n.note!)
    const config = { ...buildConfig('notes', {}, 'solta'), pool, guided: { id: study.id, title: study.title } }
    const session = await StudySession.open(config, 'solta', false)
    expect(session.byId.has('Cb5')).toBe(true)
    expect(study.bars[0][4].position).toEqual({ string: 2, fret: 0 })
    expect(study.bars[0][5].natural).toBe(true)
    expect(modeKey(config)).toContain(`study:${study.id}:`)
  })
})

describe('julgamento das notas fixas', () => {
  const notes = () => timeline(studyById('sustenidos-6')!).filter((n) => n.note)
  test('tempo livre espera a correção e conta só a primeira tentativa', () => {
    const judge = new GuidedJudge(notes(), 0.12)
    expect(judge.answer(52, 0, true, (n) => n.at)?.result).toBe('wrong-octave')
    expect(judge.next).toBe(0)
    expect(judge.answer(40, 1, true, (n) => n.at)?.first).toBe(false)
    expect(judge.next).toBe(1)
    expect(judge.attempts).toBe(1)
    expect(judge.correct).toBe(0)
  })
  test('no tempo, aceita apenas ataques dentro da tolerância e não duplica erros', () => {
    const judge = new GuidedJudge(notes(), 0.12)
    expect(judge.answer(40, -0.2, false, (n) => n.at)).toBeNull()
    expect(judge.answer(40, 0.08, false, (n) => n.at)?.result).toBe('correct')
    expect(judge.miss(0)).toBe(false)
    expect(judge.miss(1)).toBe(true)
    expect(judge.miss(1)).toBe(false)
    expect(judge.attempts).toBe(2)
    expect(judge.correct).toBe(1)
  })
})

describe('progresso e navegação', () => {
  test('rotas diretas, retorno seguro para id inválido e continuar da home', async () => {
    expect(parseHash('#/estudo/andante')).toEqual({ name: 'study', id: 'andante', run: 0 })
    expect(parseHash('#/estudo/inexistente')).toEqual({ name: 'studies' })
    expect(parseHash(routeHash({ name: 'study', id: 'corda-6-1', run: 123 }))).toEqual({ name: 'study', id: 'corda-6-1', run: 123 })
    await db.meta.put({ key: 'lastActivity', value: 'study:andante' })
    expect(await getLastPlace()).toEqual({ kind: 'study', id: 'andante' })
  })
  test('opções por estudo; polifonia não habilita correção por microfone', async () => {
    const s = studyById('andante')!
    const options = normalizeOptions(s, { mode: 'mic', tempo: 'free', bpm: 75, loops: 2 })
    expect(options).toEqual({ mode: 'practice', tempo: 'metronome', bpm: 75, loops: 2 })
    await saveStudyOptions(s.id, options)
    expect(await loadStudyOptions(s)).toEqual(options)
    expect((await loadStudyOptions(studyById('corda-6-1')!)).bpm).toBe(60)
  })
  test('ouvir não conta como prática; metrônomo sem mic não fabrica acerto', async () => {
    await saveGuidedResult('andante', { mode: 'listen', tempo: 'metronome', bpm: 60, loops: 1 })
    expect(await loadGuidedProgress()).toEqual({})
    await saveGuidedResult('andante', { mode: 'practice', tempo: 'metronome', bpm: 80, loops: 1 })
    expect((await loadGuidedProgress()).andante).toMatchObject({ practiced: 1, bestAccuracy: undefined, bestBpm: undefined })
  })
  test('BPM dominado exige microfone, tempo medido e pelo menos 90%', async () => {
    const options = { mode: 'mic' as const, tempo: 'metronome' as const, bpm: 60, loops: 1 }
    await saveGuidedResult('corda-6-1', options, 0.9)
    await saveGuidedResult('corda-6-1', { ...options, bpm: 100 }, 0.8)
    await saveGuidedResult('corda-6-1', { ...options, tempo: 'free', bpm: 120 }, 1)
    expect((await loadGuidedProgress())['corda-6-1']).toMatchObject({ practiced: 3, bestBpm: 60, bestAccuracy: 1 })
  })
})
