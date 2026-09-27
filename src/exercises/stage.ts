import { clock } from '../audio/clock'
import { namePt, type Note } from '../domain/notes'
import { ledgerSteps, staffStep } from '../domain/staff'
import {
  CLEF_END,
  clefShape,
  LABEL_Y,
  NOTEHEAD_W,
  noteShapes,
  shapeToSvg,
  STAFF_HEIGHT,
  staffLines,
  S,
  svgEl,
  yOfStep,
  type NoteDraw,
  type Shape,
} from '../staff/geometry'

/**
 * Pauta animada manipulada diretamente (fora do React): o loop de animação
 * só mexe em `transform` e classes dos grupos de nota.
 */
let stageIds = 0

export class StaffStage {
  readonly notesLayer: SVGGElement
  private bg: SVGGElement
  private hitLine: SVGLineElement | null = null
  private fade: SVGLinearGradientElement
  private maskRect: SVGRectElement
  private observer: ResizeObserver
  width = 400
  readonly height = STAFF_HEIGHT

  constructor(
    readonly svg: SVGSVGElement,
    readonly opts: { hitX?: number; fadeFrom?: number } = {},
  ) {
    svg.innerHTML = ''
    svg.classList.add('staff')
    // notas entrando pela direita ficam escondidas até cruzar a borda
    svg.style.overflow = 'hidden'
    this.bg = svgEl('g', { class: 'staff-bg' })
    this.notesLayer = svgEl('g')
    // notas somem suavemente ao passar pela clave e surgem suavemente à direita
    const id = `stage-fade-${++stageIds}`
    const defs = svgEl('defs')
    this.fade = svgEl('linearGradient', { id: `${id}-g`, gradientUnits: 'userSpaceOnUse', y1: 0, y2: 0 })
    this.maskRect = svgEl('rect', { x: 0, y: -50, height: STAFF_HEIGHT + 100, fill: `url(#${id}-g)` })
    const mask = svgEl('mask', { id, maskUnits: 'userSpaceOnUse' })
    mask.append(this.maskRect)
    defs.append(this.fade, mask)
    this.notesLayer.setAttribute('mask', `url(#${id})`)
    svg.append(defs, this.bg, this.notesLayer)
    if (opts.hitX !== undefined) {
      this.hitLine = svgEl('line', { class: 'hit-line', 'stroke-width': 0.9 * S, 'stroke-linecap': 'round' })
      this.bg.append(this.hitLine)
    }
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(svg)
    this.resize()
  }

  get hitX(): number {
    return this.opts.hitX ?? CLEF_END + 30
  }

  /** x da cabeça de uma nota centrada na linha de acerto */
  get hitNoteX(): number {
    return this.hitX - NOTEHEAD_W / 2
  }

  resize() {
    const r = this.svg.getBoundingClientRect()
    if (r.height > 0) this.width = Math.max(200, (STAFF_HEIGHT * r.width) / r.height)
    this.svg.setAttribute('viewBox', `0 0 ${this.width} ${STAFF_HEIGHT}`)
    this.svg.setAttribute('preserveAspectRatio', 'xMinYMid meet')
    this.bg.querySelectorAll('.part-staff, .part-clef').forEach((el) => el.remove())
    const frag = document.createDocumentFragment()
    for (const s of staffLines(0, this.width)) frag.append(shapeToSvg(s))
    frag.append(shapeToSvg(clefShape()))
    this.bg.prepend(frag)
    const w = this.width
    this.fade.setAttribute('x1', '0')
    this.fade.setAttribute('x2', String(w))
    this.fade.innerHTML = ''
    const from = this.opts.fadeFrom ?? CLEF_END - 4
    const stops: [number, number][] = [
      [from, 0],
      [from + 26, 1],
      [w - 24, 1],
      [w, 0],
    ]
    for (const [x, o] of stops) this.fade.append(svgEl('stop', { offset: Math.max(0, Math.min(1, x / w)), 'stop-color': 'white', 'stop-opacity': o }))
    this.maskRect.setAttribute('width', String(w))
    if (this.hitLine) {
      const x = this.hitX
      this.hitLine.setAttribute('x1', String(x))
      this.hitLine.setAttribute('x2', String(x))
      this.hitLine.setAttribute('y1', String(28))
      this.hitLine.setAttribute('y2', String(96))
    }
  }

  addNote(note: Note, x: number, label?: { text: string; opacity: number }, draw?: NoteDraw): StageNote {
    const n = new StageNote(note, label, noteShapes(note, draw))
    n.setX(x)
    this.notesLayer.append(n.g)
    return n
  }

  /** Pausa, barra de compasso ou outro desenho que anda junto com as notas. */
  addShapes(shapes: Shape[], x: number, extraClass: string): StageNote {
    const n = new StageNote(null, undefined, shapes, extraClass)
    n.setX(x)
    this.notesLayer.append(n.g)
    return n
  }

  /** Cola fixa entre a clave e as notas (atrás delas). */
  addGuide(notes: Note[], xs: { line: number; space: number }, extra: Note[] = []): StaffGuide {
    const guide = new StaffGuide(notes, xs, extra)
    this.bg.append(guide.g)
    return guide
  }

  dispose() {
    this.observer.disconnect()
    this.svg.innerHTML = ''
  }
}

/**
 * Cola das lições: o nome de cada linha e espaço usados, na altura certa.
 * Linhas numa coluna e espaços noutra, para os nomes vizinhos não se
 * encostarem. Cada nome tem opacidade própria: a cola some aos poucos, mas
 * uma nota pode acender sozinha. As `extra` (revisão) só aparecem acesas.
 */
export class StaffGuide {
  readonly g: SVGGElement
  private items = new Map<number, SVGGElement>()
  private extra = new Set<number>()

  constructor(notes: Note[], xs: { line: number; space: number }, extra: Note[] = []) {
    this.g = svgEl('g', { class: 'guide' })
    for (const n of notes) this.add(n, xs)
    for (const n of extra) if (this.add(n, xs)) this.extra.add(staffStep(n))
    this.show(0, null)
  }

  private add(n: Note, xs: { line: number; space: number }): boolean {
    const step = staffStep(n)
    if (this.items.has(step)) return false
    const onLine = step % 2 === 0
    const x = onLine ? xs.line : xs.space
    const item = svgEl('g', { class: 'guide-item' })
    // nome numa suplementar: um pedaço da linha passando por ele
    if (onLine && ledgerSteps(step).includes(step)) {
      const y = yOfStep(step)
      item.append(svgEl('line', { x1: x - 0.9 * S, x2: x + 0.9 * S, y1: y, y2: y, 'stroke-width': 0.16 * S, class: 'part-ledger' }))
    }
    const t = svgEl('text', { x, y: yOfStep(step), class: 'guide-label', 'text-anchor': 'middle', 'dominant-baseline': 'central' })
    t.textContent = namePt(n)
    item.append(t)
    this.items.set(step, item)
    this.g.append(item)
    return true
  }

  /** `base` para todos os nomes; `on` (passo da nota) aceso por inteiro. */
  show(base: number, on: number | null) {
    for (const [step, item] of this.items) {
      item.style.opacity = String(step === on ? 1 : this.extra.has(step) ? 0 : base)
      item.classList.toggle('is-on', step === on)
    }
  }

  remove() {
    this.g.remove()
  }
}

export type NoteState = 'ok' | 'err' | 'oct' | 'muted' | null

export class StageNote {
  readonly g: SVGGElement
  private lift: SVGGElement
  private label: SVGTextElement
  x = 0
  private state: NoteState = null
  private ghost: SVGGElement | null = null
  private ghostTimer: number | null = null

  constructor(
    readonly note: Note | null,
    label?: { text: string; opacity: number },
    shapes: Shape[] = note ? noteShapes(note) : [],
    extraClass = '',
  ) {
    this.g = svgEl('g', { class: `note ${extraClass}`.trim() })
    this.lift = svgEl('g', { class: 'lift' })
    for (const s of shapes) this.lift.append(shapeToSvg(s))
    this.label = svgEl('text', { x: NOTEHEAD_W / 2, y: LABEL_Y, class: 'note-label', 'text-anchor': 'middle' })
    this.setLabel(label?.text ?? '', label?.opacity ?? 0)
    this.g.append(this.lift, this.label)
  }

  setX(x: number) {
    if (x === this.x && this.g.style.transform) return
    this.x = x
    this.g.style.transform = `translate(${x.toFixed(2)}px, 0)`
  }

  setState(state: NoteState) {
    if (state === this.state) return
    if (this.state) this.g.classList.remove(`is-${this.state}`)
    if (state) this.g.classList.add(`is-${state}`)
    this.state = state
  }

  /** Mostra, na mesma coluna, a nota que foi ouvida (sombra vermelha). */
  showGhost(n: Note, seconds = 1.6) {
    this.hideGhost()
    // ao lado, para não encavalar com a nota esperada quando forem vizinhas
    const g = svgEl('g', { class: 'ghost', transform: `translate(${NOTEHEAD_W * 1.6} 0)` })
    for (const s of noteShapes(n)) g.append(shapeToSvg(s))
    this.g.append(g)
    this.ghost = g
    this.ghostTimer = window.setTimeout(() => this.hideGhost(), seconds * 1000)
  }

  hideGhost() {
    if (this.ghostTimer) window.clearTimeout(this.ghostTimer)
    this.ghost?.remove()
    this.ghost = null
  }

  setLabel(text: string, opacity: number) {
    this.label.textContent = text
    this.label.style.opacity = String(opacity)
  }

  fadeOut(after = 0.25) {
    this.g.classList.add('is-gone')
    window.setTimeout(() => this.g.remove(), after * 1000)
  }

  remove() {
    this.g.remove()
  }
}

/**
 * Relógio do exercício: `clock()` menos o tempo em pausa. Todo tempo de
 * resposta e toda posição animada usam este relógio.
 */
export class ExerciseClock {
  private offset = 0
  private pausedAt: number | null = null

  /** tempo do exercício correspondente a um instante do relógio do app */
  fromApp(appTime: number): number {
    return appTime - this.offset
  }

  /** instante do relógio do app (= relógio de áudio) para um tempo do exercício */
  toApp(t: number): number {
    return t + this.offset
  }

  now(perf?: number): number {
    if (this.pausedAt !== null) return this.pausedAt - this.offset
    return clock(perf) - this.offset
  }

  get paused(): boolean {
    return this.pausedAt !== null
  }

  pause() {
    if (this.pausedAt === null) this.pausedAt = clock()
  }

  resume() {
    if (this.pausedAt === null) return
    this.offset += clock() - this.pausedAt
    this.pausedAt = null
  }
}

/** Loop de requestAnimationFrame com início/fim explícitos. */
export class FrameLoop {
  private id: number | null = null
  constructor(private tick: (perf: number) => void) {}

  start() {
    if (this.id !== null) return
    const step = (t: number) => {
      this.id = requestAnimationFrame(step)
      this.tick(t)
    }
    this.id = requestAnimationFrame(step)
  }

  stop() {
    if (this.id !== null) cancelAnimationFrame(this.id)
    this.id = null
  }
}
