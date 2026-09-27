import { describe, expect, test } from 'vitest'
import { midiOf, noteId, parseNote } from '../domain/notes'
import { scaleItems } from '../domain/scales'
import { judge, pressedSoundingMidi } from './controller'

const items = scaleItems('solta', false)
const item = (id: string) => items.find((i) => i.id === id)!
const m = (id: string) => midiOf(parseNote(id))

describe('som do botão', () => {
  test('acerto toca a nota da pauta no som real do violão (oitava abaixo)', () => {
    expect(pressedSoundingMidi({ letter: 'G', acc: 0 }, parseNote('G4'))).toBe(m('G3'))
    expect(pressedSoundingMidi({ letter: 'E', acc: 0 }, parseNote('E3'))).toBe(m('E2'))
  })

  test('erro toca a nota apertada perto da esperada', () => {
    expect(pressedSoundingMidi({ letter: 'A', acc: 0 }, parseNote('G4'))).toBe(m('A3'))
    expect(pressedSoundingMidi({ letter: 'B', acc: 0 }, parseNote('C5'))).toBe(m('B3'))
  })
})

describe('microfone considera a transposição', () => {
  // o tracker entrega o MIDI soando; o controlador soma 12 antes de julgar
  const mic = (sounding: string) => ({ kind: 'mic' as const, writtenMidi: m(sounding) + 12, time: 0 })

  test('3ª corda solta (Sol3 soando) = Sol na 2ª linha (Sol4 escrito)', () => {
    expect(item('G4').position).toEqual({ string: 3, fret: 0 })
    expect(judge(item('G4'), mic('G3'))).toBe('correct')
  })

  test('Sol acima da pauta (Sol5 escrito) é a 1ª corda, casa 3', () => {
    expect(item('G5').position).toEqual({ string: 1, fret: 3 })
    expect(judge(item('G5'), mic('G4'))).toBe('correct')
    expect(judge(item('G5'), mic('G3'))).toBe('wrong-octave')
  })

  test('todas as notas da escala, tocadas na posição da escala, são acerto', () => {
    for (const it of scaleItems('fechada', true)) expect(judge(it, mic(noteId(it.sounding)))).toBe('correct')
  })
})

describe('configuração das atividades', async () => {
  const { buildConfig } = await import('./types')
  test('repetição é sempre metrônomo, só semínimas e sem ♯♭', () => {
    const c = buildConfig('repeat', { tempo: 'free', level: 5, accidentals: true }, 'solta')
    expect(c.tempo).toBe('metronome')
    expect(c.level).toBe(1)
    expect(c.accidentals).toBe(false)
  })
  test('60 s não existe no metrônomo; escala não tem duração', () => {
    expect(buildConfig('notes', { tempo: 'metronome', duration: 'timed' }, 'solta').duration).toBe('infinite')
    expect(buildConfig('scale', { duration: 'short' }, 'solta').duration).toBe('infinite')
  })
  test('som só na Pauta, piano por padrão', () => {
    expect(buildConfig('reading', undefined, 'solta').timbre).toBe('piano')
    expect(buildConfig('notes', { timbre: 'piano' }, 'solta').timbre).toBe('off')
  })
})
