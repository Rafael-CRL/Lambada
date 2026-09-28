import type { Note } from '../domain/notes'
import type { Figure } from '../domain/rhythm'
import { ledgerSteps, staffStep, stemUp } from '../domain/staff'

/**
 * Geometria da pauta em unidades do viewBox. Glifos SMuFL (Bravura):
 * 1 em = 4 espaços de pauta, origem do glifo na linha de base.
 */

/** Espaço entre linhas */
export const S = 10
/** passo da 3ª linha (Si4), onde fica a linha da pauta de ritmo */
const MIDDLE_STEP = 4
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
  gClef: '\uE050',
  notehead: '\uE0A4',
  noteheadHalf: '\uE0A3',
  noteheadWhole: '\uE0A2',
  sharp: '\uE262',
  flat: '\uE260',
  natural: '\uE261',
  percussionClef: '\uE069',
  /** timeSig0; os dígitos seguem em ordem */
  timeSig0: '\uE080',
  dot: '\uE1E7',
  flag8thUp: '\uE240',
  flag8thDown: '\uE241',
  restWhole: '\uE4E3',
  restHalf: '\uE4E4',
  restQuarter: '\uE4E5',
} as const

/** largura da cabeça da semibreve (Bravura: 1.688 espaço) */
const WHOLE_W = 1.688 * S

export function yOfStep(step: number): number {
  return BOTTOM_Y - (step * S) / 2
}

export type Shape =
  | { k: 'glyph'; x: number; y: number; ch: string; part: 'head' | 'acc' | 'clef' | 'dot' | 'flag' | 'rest' | 'timesig' }
  | {
      k: 'line'
      x1: number
      y1: number
      x2: number
      y2: number
      w: number
      part: 'staff' | 'ledger' | 'stem' | 'beam' | 'barline'
    }

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

export interface NoteDraw {
  /** figura (padrão: semínima) */
  figure?: Figure
  /** haste para cima (true) ou para baixo (false), sem ser barra de colcheia */
  up?: boolean
  /** mostra o ♮ numa nota natural (lição do bequadro) */
  natural?: boolean
  /** haste com direção e ponta forçadas (colcheias ligadas) */
  stem?: { up: boolean; toY: number }
  /** barra de colcheia até a haste da nota seguinte, dx unidades à direita */
  beamTo?: number
}

export function stemX(up: boolean): number {
  return up ? NOTEHEAD_W - 0.06 * S : 0.06 * S
}

/** Ponta natural da haste de uma nota (y), para alinhar barras de colcheia. */
export function naturalStemEnd(n: Note, up: boolean): number {
  const y = yOfStep(staffStep(n))
  const len = Math.max(STEM_LEN, Math.abs(y - yOfStep(4)))
  return up ? y - len : y + len
}

/**
 * Formas de uma nota escrita com a cabeça começando em x = 0
 * (o chamador translada o grupo). Centro da cabeça em NOTEHEAD_W / 2.
 */
export function noteShapes(n: Note, draw: NoteDraw = {}): Shape[] {
  const figure = draw.figure ?? 'quarter'
  const step = staffStep(n)
  const y = yOfStep(step)
  const shapes: Shape[] = []
  const whole = figure === 'whole'
  // semibreve é mais larga: centraliza no mesmo eixo das outras cabeças
  const headX = whole ? (NOTEHEAD_W - WHOLE_W) / 2 : 0
  const headW = whole ? WHOLE_W : NOTEHEAD_W
  for (const ls of ledgerSteps(step)) {
    const ly = yOfStep(ls)
    shapes.push({ k: 'line', x1: headX - 0.4 * S, x2: headX + headW + 0.4 * S, y1: ly, y2: ly, w: 0.16 * S, part: 'ledger' })
  }
  if (n.acc !== 0) {
    shapes.push({ k: 'glyph', x: headX + (n.acc === 1 ? -1.45 * S : -1.3 * S), y, ch: n.acc === 1 ? GLYPH.sharp : GLYPH.flat, part: 'acc' })
  } else if (draw.natural) {
    shapes.push({ k: 'glyph', x: headX - 1.2 * S, y, ch: GLYPH.natural, part: 'acc' })
  }
  const head = whole ? GLYPH.noteheadWhole : figure === 'half' || figure === 'dotted-half' ? GLYPH.noteheadHalf : GLYPH.notehead
  shapes.push({ k: 'glyph', x: headX, y, ch: head, part: 'head' })
  if (figure === 'dotted-half' || figure === 'dotted-quarter') {
    // o ponto fica sempre num espaço
    const dotY = step % 2 === 0 ? yOfStep(step + 1) : y
    shapes.push({ k: 'glyph', x: NOTEHEAD_W + 0.3 * S, y: dotY, ch: GLYPH.dot, part: 'dot' })
  }
  if (!whole) {
    const up = draw.stem?.up ?? draw.up ?? stemUp(step)
    const sx = stemX(up)
    const y1 = up ? y - 0.17 * S : y + 0.17 * S
    const y2 = draw.stem?.toY ?? naturalStemEnd(n, up)
    shapes.push({ k: 'line', x1: sx, x2: sx, y1, y2, w: 0.12 * S, part: 'stem' })
    if (figure === 'eighth' && draw.beamTo !== undefined) {
      const by = up ? y2 + 0.25 * S : y2 - 0.25 * S
      shapes.push({ k: 'line', x1: sx - 0.06 * S, x2: sx + draw.beamTo + 0.06 * S, y1: by, y2: by, w: 0.5 * S, part: 'beam' })
    } else if (figure === 'eighth' && !draw.stem) {
      shapes.push({ k: 'glyph', x: sx - 0.06 * S, y: y2, ch: up ? GLYPH.flag8thUp : GLYPH.flag8thDown, part: 'flag' })
    }
  }
  return shapes
}

/** Pausas: semibreve pendurada na 4ª linha; mínima sobre a 3ª; semínima centrada. */
export function restShapes(figure: Figure): Shape[] {
  if (figure === 'whole') return [{ k: 'glyph', x: 0, y: yOfStep(6), ch: GLYPH.restWhole, part: 'rest' }]
  if (figure === 'half') return [{ k: 'glyph', x: 0, y: yOfStep(4), ch: GLYPH.restHalf, part: 'rest' }]
  return [{ k: 'glyph', x: 0, y: yOfStep(4), ch: GLYPH.restQuarter, part: 'rest' }]
}

export function barlineShapes(single = false, final = false): Shape[] {
  // pauta de uma linha: barra curta, cruzando a linha do meio
  const [y1, y2] = single ? [yOfStep(6), yOfStep(2)] : [yOfStep(0), yOfStep(8)]
  const bar: Shape = { k: 'line', x1: 0, x2: 0, y1, y2, w: 0.16 * S, part: 'barline' }
  if (!final) return [bar]
  // barra final: fina + grossa
  return [
    { ...bar, x1: -0.7 * S, x2: -0.7 * S },
    { ...bar, x1: 0, x2: 0, w: 0.5 * S },
  ]
}

/** Linha única (pauta de ritmo), na altura da 3ª linha. */
export function singleLine(x1: number, x2: number): Shape {
  const y = yOfStep(MIDDLE_STEP)
  return { k: 'line', x1, x2, y1: y, y2: y, w: 0.13 * S, part: 'staff' }
}

export function percussionClefShape(): Shape {
  return { k: 'glyph', x: CLEF_X, y: yOfStep(MIDDLE_STEP), ch: GLYPH.percussionClef, part: 'clef' }
}

/** Largura de um dígito da fórmula de compasso (Bravura: ~1,8 espaço). */
export const TIMESIG_W = 1.8 * S

/**
 * Fórmula de compasso (x/4). Na pauta de cinco linhas, o de cima ocupa as
 * linhas 3–5 e o de baixo as linhas 1–3; na de uma linha, acima e abaixo dela.
 */
export function timeSigShapes(beats: number, x: number, single = false): Shape[] {
  const digit = (n: number) => String.fromCharCode(GLYPH.timeSig0.charCodeAt(0) + n)
  const [top, bottom] = single ? [yOfStep(MIDDLE_STEP) - S, yOfStep(MIDDLE_STEP) + S] : [yOfStep(6), yOfStep(2)]
  return [
    { k: 'glyph', x, y: top, ch: digit(beats), part: 'timesig' },
    { k: 'glyph', x, y: bottom, ch: digit(4), part: 'timesig' },
  ]
}

/**
 * Hastes de um par de colcheias ligadas: mesma direção (pela média das
 * alturas) e barra reta na ponta mais afastada.
 */
export function beamedPairStems(a: Note, b: Note): { up: boolean; toY: number } {
  const up = (staffStep(a) + staffStep(b)) / 2 < 4
  const ends = [naturalStemEnd(a, up), naturalStemEnd(b, up)]
  return { up, toY: up ? Math.min(...ends) : Math.max(...ends) }
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
