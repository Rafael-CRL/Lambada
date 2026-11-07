/** Paginação da partitura: quantos compassos por linha, quantas linhas cabem e qual linha mostrar. */

const GAP = 12
const CARD_PAD = 26 // borda + padding horizontal/vertical do cartão
const MIN_CELL = 200

export interface PageGrid { cols: number; rows: number; cellHeight: number }

/** `aspect` é altura/largura do SVG de um compasso. */
export function pageGrid(width: number, height: number, aspect: number, bars: number): PageGrid {
  const cols = Math.max(1, Math.min(4, Math.floor((width + GAP) / (MIN_CELL + GAP)), bars))
  const cellWidth = (width - GAP * (cols - 1)) / cols
  const cellHeight = (cellWidth - CARD_PAD) * aspect + CARD_PAD
  const rows = Math.max(1, Math.floor((height + GAP) / (cellHeight + GAP)))
  return { cols, rows, cellHeight }
}

/**
 * Primeira linha visível. Com 2+ linhas, a página avança de (rows − 1) em (rows − 1):
 * a linha tocada fica sempre em cima e a seguinte já aparece embaixo, antes de precisar dela.
 */
export function firstRow(currentRow: number, rows: number, totalRows: number): number {
  const step = Math.max(1, rows - 1)
  const start = currentRow - (currentRow % step)
  return Math.max(0, Math.min(start, totalRows - rows))
}
