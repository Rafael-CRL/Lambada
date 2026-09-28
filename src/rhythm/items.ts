import { cellBeats, cellEvents, isRestCell, type CellId, type Meter, type RhythmEvent } from '../domain/rhythm'
import { shuffle } from '../engine/picker'
import type { LessonCard } from '../lessons/lessons'
import { makePattern, placed, signature, type CellSpec, type RhythmPattern } from './patterns'

/**
 * Como se aprende um ritmo (à la Musicca / Complete Rhythm Trainer):
 * imitar (ouvir e bater), ler (só o metrônomo), escrever (ouvir e montar),
 * e duas perguntas rápidas: quantos pulsos dura a figura, e que figura
 * completa o compasso.
 */
export type RhythmMode = 'imitate' | 'read' | 'write' | 'value' | 'complete'

export interface RhythmPart {
  mode: RhythmMode
  count: number
  /** compassos por trecho (imitar/ler/escrever) */
  bars?: number
}

export interface RhythmBody extends CellSpec {
  kind: 'rhythm'
  /** compassos usados (sorteados por trecho); padrão 4/4 */
  meters?: Meter[]
  /** pauta de uma linha (só ritmo) ou de cinco (com uma nota fixa) */
  staff?: 'line' | 'staff'
  bpm?: number
  parts: RhythmPart[]
  /** Desafio: só leitura, sem ouvir antes */
  challenge?: boolean
}

export type RhythmItem =
  | { mode: 'imitate' | 'read' | 'write'; pattern: RhythmPattern; card?: LessonCard; retry?: boolean }
  /** quantos pulsos dura a figura (ou a pausa) */
  | { mode: 'value'; cell: CellId; options: number[]; card?: LessonCard }
  /** o compasso com um buraco no evento `gap`; escolher a figura que falta */
  | { mode: 'complete'; pattern: RhythmPattern; gap: number; answer: CellId; options: CellId[]; card?: LessonCard }

const CARDS: Record<RhythmMode, LessonCard> = {
  imitate: { title: 'Ouça e repita', detail: 'marque o pulso com o pé e bata o ritmo no espaço' },
  read: { title: 'Agora leia', detail: 'só o metrônomo toca: leia e bata' },
  write: { title: 'Ouça e escreva', detail: 'monte o ritmo com as figuras' },
  value: { title: 'Quantos pulsos?', detail: 'quanto dura cada figura' },
  complete: { title: 'Complete o compasso', detail: 'qual figura falta?' },
}

/** Valor em pulsos da figura de uma célula de um evento só (a colcheia vale ½). */
export function cellValue(id: CellId): number {
  return id === 'ee' ? 0.5 : id === 'dqe' ? 1.5 : cellBeats(id)
}

/** "½", "1½", "2" */
export function beatsLabel(v: number): string {
  const whole = Math.floor(v)
  const half = v - whole === 0.5
  return half ? `${whole || ''}½` : String(v)
}

/** Figura mostrada na pergunta de "quantos pulsos": o par de colcheias mostra uma colcheia; a pontuada + colcheia, a pontuada. */
export function valueFigure(id: CellId): { figure: RhythmEvent['figure']; rest: boolean } {
  const e = cellEvents(id)[0]
  return { figure: e.figure, rest: e.rest }
}

function valueOptions(cells: CellId[]): number[] {
  const vals = new Set(cells.map(cellValue))
  for (const v of [1, 2, 4]) if (vals.size < 3) vals.add(v)
  return [...vals].sort((a, b) => a - b)
}

/** Figuras de um evento só que podem preencher um buraco (valores distintos). */
function fillCells(cells: CellId[], meter: Meter): CellId[] {
  const single = cells.filter((c) => cellEvents(c).length === 1 && !isRestCell(c) && cellBeats(c) <= meter)
  const byValue = new Map<number, CellId>()
  for (const c of single) if (!byValue.has(cellBeats(c))) byValue.set(cellBeats(c), c)
  return [...byValue.values()].sort((a, b) => cellBeats(a) - cellBeats(b))
}

export function rhythmItems(body: RhythmBody, rng: () => number = Math.random): RhythmItem[] {
  const meters = body.meters ?? [4]
  const meterAt = (i: number): Meter => meters[i % meters.length]
  const items: RhythmItem[] = []
  let last: string | undefined
  let n = 0
  for (const part of body.parts) {
    const card = body.challenge && part.mode === 'read' ? { title: 'Desafio', detail: `${part.count} trechos, sem ouvir antes` } : CARDS[part.mode]
    const start = items.length
    if (part.mode === 'value') {
      // saco embaralhado (a figura nova entra duas vezes), sem repetir a anterior
      let bag: CellId[] = []
      let prev: CellId | null = null
      for (let i = 0; i < part.count; i++) {
        if (bag.length === 0) bag = shuffle([...body.cells, ...(body.focus ?? [])], rng)
        const k = Math.max(0, bag.findIndex((c) => c !== prev))
        prev = bag.splice(k, 1)[0]
        items.push({ mode: 'value', cell: prev, options: valueOptions(body.cells) })
      }
    } else if (part.mode === 'complete') {
      for (let i = 0; i < part.count; i++) {
        const meter = meterAt(n++)
        const options = fillCells(body.cells, meter)
        let pattern = makePattern(body, meter, 1, rng, last)
        let gaps = placed(pattern).filter((e) => !e.rest && !e.beam && e.figure !== 'dotted-quarter' && options.some((o) => cellEvents(o)[0].figure === e.figure))
        for (let t = 0; t < 30 && (gaps.length === 0 || placed(pattern).length < 2); t++) {
          pattern = makePattern(body, meter, 1, rng, last)
          gaps = placed(pattern).filter((e) => !e.rest && !e.beam && e.figure !== 'dotted-quarter' && options.some((o) => cellEvents(o)[0].figure === e.figure))
        }
        if (gaps.length === 0 || options.length < 2) continue
        const focus = gaps.filter((g) => (body.focus ?? []).some((f) => cellEvents(f)[0].figure === g.figure))
        const gap = (focus.length ? focus : gaps)[Math.floor(rng() * (focus.length || gaps.length))]
        const answer = options.find((o) => cellEvents(o)[0].figure === gap.figure)!
        last = signature(pattern)
        items.push({ mode: 'complete', pattern, gap: gap.index, answer, options })
      }
    } else {
      for (let i = 0; i < part.count; i++) {
        // imitar e escrever: 1 compasso (ouvir + repetir já dobra o tempo); ler: 2
        const pattern = makePattern(body, meterAt(n++), part.bars ?? (part.mode === 'read' ? 2 : 1), rng, last)
        last = signature(pattern)
        items.push({ mode: part.mode, pattern })
      }
    }
    if (items[start]) items[start].card = card
  }
  return items
}
