import { describe, expect, test } from 'vitest'
import { LESSON } from '../config'
import { parseNote } from '../domain/notes'
import { letterDistance, TipTrigger, tipFor } from './tips'

const n = parseNote

describe('dicas', () => {
  test('distância em notas, pelo caminho mais curto', () => {
    expect(letterDistance(n('A4'), n('G4'))).toBe(1)
    expect(letterDistance(n('E4'), n('G4'))).toBe(-2)
    expect(letterDistance(n('C4'), n('B4'))).toBe(1)
    expect(letterDistance(n('G4'), n('C5'))).toBe(-3)
  })

  test('a dica segue o erro', () => {
    // pulo: Mi no lugar do Sol (linha → linha)
    expect(tipFor(n('G4'), n('E4'), false, null)).toBe('pulo')
    // vizinha: primeiro a referência da clave, depois o passo
    expect(tipFor(n('A4'), n('G4'), false, null)).toBe('clave')
    expect(tipFor(n('A4'), n('G4'), false, 'clave')).toBe('passo')
    // metade de cima, com o Dó já conhecido
    expect(tipFor(n('D5'), n('C5'), true, null)).toBe('do')
    expect(tipFor(n('D5'), n('C5'), false, null)).toBe('clave')
    expect(tipFor(n('C4'), n('D4'), false, null)).toBe('abaixo')
    expect(tipFor(n('A5'), n('G5'), false, null)).toBe('acima')
    expect(tipFor(n('F#4'), n('F4'), false, null)).toBe('acidente')
  })

  test('dispara com dois erros seguidos ou muitos erros; nunca duas próximas', () => {
    const t = new TipTrigger()
    expect(t.push(false)).toBe(false)
    expect(t.push(false)).toBe(true)
    // logo depois, não
    for (let i = 0; i < LESSON.tipGap - 2; i++) expect(t.push(false)).toBe(false)
    expect(t.push(true)).toBe(false)
    expect(t.push(false)).toBe(true)

    const spread = new TipTrigger()
    const seq = [false, true, false, true, false]
    expect(seq.map((ok) => spread.push(ok))).toEqual([false, false, false, false, true])
  })
})
