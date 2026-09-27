import type { Note } from '../domain/notes'
import { ledgerSteps, staffStep, stemUp } from '../domain/staff'

/**
 * Geometria da pauta em unidades do viewBox. Glifos SMuFL (Bravura):
 * 1 em = 4 espaços de pauta, origem do glifo na linha de base.
 */

/** Espaço entre linhas */
export const S = 10
export const FONT_SIZE = 4 * S
/** y da primeira linha (Mi4 escrito) */
export const BOTTOM_Y = 82
/** altura total do viewBox: cobre Mi3 (3 suplementares abaixo), Mi6 (3 acima) e a linha dos rótulos */
export const STAFF_HEIGHT = 146
export const LABEL_Y = 139
export const CLEF_X = 6
/** espaço ocupado pela clave */
export const CLEF_END = 40

export const NOTEHEAD_W = 1.18 * S
const STEM_LEN = 3.5 * S

export const GLYPH = {
  gClef: '',
  notehead: '',
  sharp: '',
  flat: '',
} as const

export function yOfStep(step: number): number {
  return BOTTOM_Y - (step * S) / 2
}

export type Shape =
  | { k: 'glyph'; x: number; y: number; ch: string; part: 'head' | 'acc' | 'clef' }
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; w: number; part: 'staff' | 'ledger' | 'stem' }

export function staffLines(x1: number, x2: number): Shape[] {
  return [0, 2, 4, 6, 8].map((step) => ({
    k: 'line' as const,
    x1,
    x2,
    y1: yOfStep(step),
    y2: yOfStep(step),
    w: 0.13 * S,
    part: 'staff' as const,
  }))
}

export function clefShape(): Shape {
  return { k: 'glyph', x: CLEF_X, y: yOfStep(2), ch: GLYPH.gClef, part: 'clef' }
}

/**
 * Formas de uma semínima escrita com a cabeça começando em x = 0
 * (o chamador translada o grupo). Centro da cabeça em NOTEHEAD_W / 2.
 */
export function noteShapes(n: Note, withStem = true): Shape[] {
  const step = staffStep(n)
  const y = yOfStep(step)
  const shapes: Shape[] = []
  for (const ls of ledgerSteps(step)) {
    const ly = yOfStep(ls)
    shapes.push({ k: 'line', x1: -0.4 * S, x2: NOTEHEAD_W + 0.4 * S, y1: ly, y2: ly, w: 0.16 * S, part: 'ledger' })
  }
  if (n.acc !== 0) {
    shapes.push({ k: 'glyph', x: n.acc === 1 ? -1.45 * S : -1.3 * S, y, ch: n.acc === 1 ? GLYPH.sharp : GLYPH.flat, part: 'acc' })
  }
  shapes.push({ k: 'glyph', x: 0, y, ch: GLYPH.notehead, part: 'head' })
  if (withStem) {
    const up = stemUp(step)
    // stem alcança ao menos a linha do meio em notas com suplementares
    const len = Math.max(STEM_LEN, Math.abs(y - yOfStep(4)))
    const sx = up ? NOTEHEAD_W - 0.06 * S : 0.06 * S
    const y1 = up ? y - 0.17 * S : y + 0.17 * S
    const y2 = up ? y - len : y + len
    shapes.push({ k: 'line', x1: sx, x2: sx, y1, y2, w: 0.12 * S, part: 'stem' })
  }
  return shapes
}

// ---------------------------------------------------------------- DOM imperativo

const SVG_NS = 'http://www.w3.org/2000/svg'

export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  return el
}

export function shapeToSvg(s: Shape): SVGElement {
  if (s.k === 'glyph') {
    const t = svgEl('text', { x: s.x, y: s.y, class: `smufl part-${s.part}` })
    t.textContent = s.ch
    return t
  }
  return svgEl('line', {
    x1: s.x1,
    y1: s.y1,
    x2: s.x2,
    y2: s.y2,
    'stroke-width': s.w,
    class: `part-${s.part}`,
  })
}
