import { describe, expect, test } from 'vitest'
import { midiAt, positionsOf, STANDARD_TUNING } from './fretboard'
import {
  matchButton,
  matchPitch,
  midiOf,
  namePt,
  note,
  noteId,
  parseNote,
  spellingsOf,
  writtenFromSounding,
  writtenMidiFromSoundingMidi,
} from './notes'
import { deriveAccidentalPosition, scaleItems, scaleNotes, scaleSequence, unlockOrder } from './scales'
import { inStaffRange, ledgerSteps, staffStep, stemUp } from './staff'

const m = (id: string) => midiOf(parseNote(id))

describe('notas', () => {
  test('MIDI', () => {
    expect(m('C4')).toBe(60)
    expect(m('A4')).toBe(69)
    expect(m('E2')).toBe(40)
    expect(m('C#4')).toBe(61)
    expect(m('Db4')).toBe(61)
  })

  test('id round-trip', () => {
    for (const id of ['C4', 'F#3', 'Bb2', 'E6']) expect(noteId(parseNote(id))).toBe(id)
  })

  test('nomes em português', () => {
    expect(namePt(parseNote('C#4'))).toBe('Dó♯')
    expect(namePt(parseNote('Bb2'))).toBe('Si♭')
    expect(namePt(parseNote('G3'))).toBe('Sol')
  })

  test('grafias excluem Mi♯, Si♯, Dó♭ e Fá♭', () => {
    expect(spellingsOf(m('F4')).map(noteId)).toEqual(['F4'])
    expect(spellingsOf(m('C4')).map(noteId)).toEqual(['C4'])
    expect(spellingsOf(m('B3')).map(noteId)).toEqual(['B3'])
    expect(spellingsOf(m('E4')).map(noteId)).toEqual(['E4'])
    expect(spellingsOf(m('C#4')).map(noteId)).toEqual(['C#4', 'Db4'])
  })

  test('violão soa uma oitava abaixo do escrito', () => {
    expect(noteId(writtenFromSounding(parseNote('E2')))).toBe('E3')
    expect(writtenMidiFromSoundingMidi(m('A2'))).toBe(m('A3'))
  })

  test('comparação por pitch aceita enarmônico e exige oitava', () => {
    const expected = parseNote('Db5')
    expect(matchPitch(expected, m('C#5'))).toBe('correct')
    expect(matchPitch(expected, m('C#4'))).toBe('wrong-octave')
    expect(matchPitch(expected, m('C#6'))).toBe('wrong-octave')
    expect(matchPitch(expected, m('D5'))).toBe('wrong')
  })

  test('botões exigem a grafia exata', () => {
    expect(matchButton(parseNote('Db5'), note('D', -1, 0))).toBe(true)
    expect(matchButton(parseNote('Db5'), note('C', 1, 0))).toBe(false)
  })
})

describe('braço', () => {
  test('afinação padrão', () => {
    expect([1, 2, 3, 4, 5, 6].map((s) => STANDARD_TUNING[s as 1])).toEqual(
      ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'].map(m),
    )
  })

  test('6 cordas × casas 0–12', () => {
    expect(midiAt({ string: 1, fret: 12 })).toBe(m('E5'))
    expect(positionsOf(m('E2'))).toEqual([{ string: 6, fret: 0 }])
    expect(positionsOf(m('E4'))).toEqual([
      { string: 1, fret: 0 },
      { string: 2, fret: 5 },
      { string: 3, fret: 9 },
    ])
    expect(positionsOf(m('F5'))).toEqual([])
  })
})

describe('escalas', () => {
  const soltaSpec: [number, string, number][] = [
    [6, 'E2', 0], [6, 'F2', 1], [6, 'G2', 3], [5, 'A2', 0], [5, 'B2', 2], [5, 'C3', 3],
    [4, 'D3', 0], [4, 'E3', 2], [4, 'F3', 3], [3, 'G3', 0], [3, 'A3', 2], [2, 'B3', 0],
    [2, 'C4', 1], [2, 'D4', 3], [1, 'E4', 0], [1, 'F4', 1], [1, 'G4', 3],
  ]
  const fechadaSpec: [number, string, number][] = [
    [6, 'E2', 0], [6, 'F2', 1], [6, 'G2', 3], [6, 'A2', 5], [5, 'B2', 2], [5, 'C3', 3],
    [5, 'D3', 5], [4, 'E3', 2], [4, 'F3', 3], [4, 'G3', 5], [3, 'A3', 2], [3, 'B3', 4],
    [2, 'C4', 1], [2, 'D4', 3], [2, 'E4', 5], [1, 'F4', 1], [1, 'G4', 3],
  ]

  test.each([
    ['solta', soltaSpec],
    ['fechada', fechadaSpec],
  ] as const)('%s: 17 naturais nas posições da especificação', (scale, spec) => {
    const notes = scaleNotes(scale, false)
    expect(notes).toHaveLength(17)
    for (const [string, id, fret] of spec) {
      const n = notes.find((x) => x.midi === m(id))!
      expect(n.position).toEqual({ string, fret })
      // a posição de fato produz a nota no modelo do braço
      expect(midiAt(n.position)).toBe(m(id))
    }
  })

  test.each(['solta', 'fechada'] as const)('%s com acidentes: 28 notas cromáticas E2–G4', (scale) => {
    const notes = scaleNotes(scale, true)
    expect(notes).toHaveLength(28)
    expect(notes[0].midi).toBe(m('E2'))
    expect(notes[27].midi).toBe(m('G4'))
    notes.forEach((n, i) => {
      expect(n.midi).toBe(m('E2') + i)
      expect(midiAt(n.position)).toBe(n.midi)
    })
  })

  test('solta: acidentes na janela 0–4', () => {
    for (const n of scaleNotes('solta', true)) {
      expect(n.position.fret).toBeGreaterThanOrEqual(0)
      expect(n.position.fret).toBeLessThanOrEqual(4)
    }
    expect(deriveAccidentalPosition('solta', m('G#2'))).toEqual({ string: 6, fret: 4 })
    expect(deriveAccidentalPosition('solta', m('C#4'))).toEqual({ string: 2, fret: 2 })
  })

  test('fechada: acidentes na janela 1–5, só o Mi grave solto', () => {
    for (const n of scaleNotes('fechada', true)) {
      if (n.midi === m('E2')) expect(n.position).toEqual({ string: 6, fret: 0 })
      else {
        expect(n.position.fret).toBeGreaterThanOrEqual(1)
        expect(n.position.fret).toBeLessThanOrEqual(5)
      }
    }
    expect(deriveAccidentalPosition('fechada', m('D#3'))).toEqual({ string: 4, fret: 1 })
    expect(deriveAccidentalPosition('fechada', m('G#3'))).toEqual({ string: 3, fret: 1 })
  })

  test('acidentes ficam na corda de uma natural vizinha', () => {
    for (const scale of ['solta', 'fechada'] as const) {
      const all = scaleNotes(scale, true)
      for (const n of all.filter((x) => !x.natural)) {
        const neighbours = all.filter((x) => x.natural && Math.abs(x.midi - n.midi) === 1)
        expect(neighbours.map((x) => x.position.string)).toContain(n.position.string)
      }
    }
  })

  test('itens: acidentes geram duas grafias escritas', () => {
    const items = scaleItems('solta', true)
    expect(items).toHaveLength(17 + 11 * 2)
    const cs = items.filter((i) => i.midi === m('C#4')).map((i) => i.id)
    expect(cs).toEqual(['C#5', 'Db5'])
    // escritas uma oitava acima
    expect(items[0].id).toBe('E3')
    expect(items.at(-1)!.id).toBe('G5')
    expect(scaleItems('fechada', false).map((i) => i.id)).not.toContain('Fb3')
  })

  test('sequência de escala sobe com ♯ e desce com ♭', () => {
    const seq = scaleSequence(scaleItems('solta', true)).map((i) => i.id)
    expect(seq.slice(0, 3)).toEqual(['E3', 'F3', 'F#3'])
    expect(seq).toContain('Gb3')
    expect(seq.at(-1)).toBe('E3')
    expect(seq).toHaveLength(28 + 27)
  })

  test('ordem de desbloqueio começa pela corda 1', () => {
    const order = unlockOrder(scaleItems('solta', false)).map((i) => i.sounding)
    expect(order.slice(0, 3).map(noteId)).toEqual(['E4', 'F4', 'G4'])
    expect(noteId(order.at(-1)!)).toBe('G2')
  })
})

describe('pauta', () => {
  test('passos', () => {
    expect(staffStep(parseNote('E4'))).toBe(0)
    expect(staffStep(parseNote('F5'))).toBe(8)
    expect(staffStep(parseNote('C4'))).toBe(-2)
    expect(staffStep(parseNote('E3'))).toBe(-7)
    expect(staffStep(parseNote('E6'))).toBe(14)
    expect(staffStep(parseNote('C#4'))).toBe(-2)
  })

  test('linhas suplementares abaixo e acima', () => {
    expect(ledgerSteps(staffStep(parseNote('E3')))).toEqual([-2, -4, -6])
    expect(ledgerSteps(staffStep(parseNote('C4')))).toEqual([-2])
    expect(ledgerSteps(staffStep(parseNote('D4')))).toEqual([])
    expect(ledgerSteps(staffStep(parseNote('G5')))).toEqual([])
    expect(ledgerSteps(staffStep(parseNote('A5')))).toEqual([10])
    expect(ledgerSteps(staffStep(parseNote('E6')))).toEqual([10, 12, 14])
  })

  test('hastes', () => {
    expect(stemUp(staffStep(parseNote('A4')))).toBe(true)
    expect(stemUp(staffStep(parseNote('B4')))).toBe(false)
  })

  test('âmbito escrito E3–E6', () => {
    expect(inStaffRange(parseNote('E3'))).toBe(true)
    expect(inStaffRange(parseNote('E6'))).toBe(true)
    expect(inStaffRange(parseNote('D3'))).toBe(false)
    expect(inStaffRange(parseNote('F6'))).toBe(false)
    // toda a região do braço (E2–E5 soando) cabe na pauta
    expect(inStaffRange(writtenFromSounding(parseNote('E5')))).toBe(true)
  })
})

describe('posição exibida para nota tocada', () => {
  test('usa a posição da escala quando existe', async () => {
    const { displayPosition } = await import('./scales')
    expect(displayPosition('fechada', m('B3'), false)).toEqual({ string: 3, fret: 4 })
    expect(displayPosition('solta', m('B3'), false)).toEqual({ string: 2, fret: 0 })
    // fora da escala: posição mais próxima da janela
    expect(displayPosition('solta', m('A4'), false)).toEqual({ string: 1, fret: 5 })
    expect(displayPosition('solta', m('E5'), false)).toEqual({ string: 1, fret: 12 })
  })
})
