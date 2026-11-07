import { describe, expect, it } from 'vitest'
import { firstRow, pageGrid } from './pages'

describe('paginação da partitura', () => {
  it('cabe tudo numa página quando há espaço', () => {
    const g = pageGrid(1000, 700, 0.56, 16)
    expect(g.cols).toBe(4)
    expect(g.rows * g.cols).toBeGreaterThanOrEqual(16)
  })
  it('no celular usa 1 coluna e ao menos 1 linha', () => {
    const g = pageGrid(360, 100, 0.56, 10)
    expect(g.cols).toBe(1)
    expect(g.rows).toBe(1)
  })
  it('a linha tocada fica em cima e a próxima já aparece', () => {
    expect([0, 1, 2, 3].map((r) => firstRow(r, 2, 5))).toEqual([0, 1, 2, 3])
    expect([0, 1, 2, 3, 4].map((r) => firstRow(r, 3, 5))).toEqual([0, 0, 2, 2, 2])
  })
  it('nunca passa do fim nem fica negativo', () => {
    expect(firstRow(4, 2, 5)).toBe(3)
    expect(firstRow(0, 9, 3)).toBe(0)
  })
})
