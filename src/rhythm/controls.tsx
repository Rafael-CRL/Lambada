import { useEffect, useRef, useState } from 'react'
import { cellEvents, type CellId } from '../domain/rhythm'
import { cx, Kbd } from '../ui/controls'
import { FigureGlyph } from './RhythmStaff'

/**
 * Onde se bate o ritmo: a barra de espaço, ou um clique/toque nesta área.
 * Pisca verde na batida certa e vermelho na batida a mais.
 */
export function TapPad({ onTap, turn, disabled }: { onTap: (timeStamp: number) => 'ok' | 'err' | null; turn: 'listen' | 'tap' | null; disabled?: boolean }) {
  const [flash, setFlash] = useState<{ r: 'ok' | 'err'; n: number } | null>(null)
  const timer = useRef<number | null>(null)
  const press = (t: number) => {
    if (disabled) return
    const r = onTap(t)
    if (!r) return
    setFlash((f) => ({ r, n: (f?.n ?? 0) + 1 }))
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setFlash(null), 160)
  }
  const pressRef = useRef(press)
  pressRef.current = press

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' || e.repeat) return
      e.preventDefault()
      pressRef.current(e.timeStamp)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), [])

  return (
    <button
      type="button"
      tabIndex={-1}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.preventDefault()
        press(e.timeStamp)
      }}
      className={cx(
        'flex h-20 w-full items-center justify-center gap-3 rounded-xl text-lg font-medium select-none transition-colors duration-100 touch-manipulation sm:h-24',
        !flash && (turn === 'tap' ? 'bg-surface-2 text-text' : 'bg-surface text-sub'),
        flash?.r === 'ok' && 'bg-ok text-accent-ink',
        flash?.r === 'err' && 'bg-err text-accent-ink',
      )}
    >
      {turn === 'listen' ? 'ouça' : turn === 'tap' ? 'bata o ritmo' : 'espere a contagem'}
      <Kbd>espaço</Kbd>
    </button>
  )
}

/**
 * Paleta da escrita: uma figura por botão (atalhos 1, 2, 3…), apagar
 * (⌫), ouvir de novo (R) e conferir (Enter). Figuras que não cabem no
 * compasso ficam apagadas.
 */
export function Palette({
  cells,
  fits,
  onAdd,
  onErase,
  onReplay,
  onCheck,
  canCheck,
  disabled,
}: {
  cells: CellId[]
  fits: (id: CellId) => boolean
  onAdd: (id: CellId) => void
  onErase: () => void
  onReplay: () => void
  onCheck: () => void
  canCheck: boolean
  disabled?: boolean
}) {
  const ref = useRef({ cells, fits, onAdd, onErase, onReplay, onCheck, disabled })
  ref.current = { cells, fits, onAdd, onErase, onReplay, onCheck, disabled }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const p = ref.current
      if (p.disabled || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= p.cells.length) {
        e.preventDefault()
        if (p.fits(p.cells[n - 1])) p.onAdd(p.cells[n - 1])
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        p.onErase()
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        p.onReplay()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        p.onCheck()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const btn = 'relative flex h-16 items-center justify-center rounded-xl bg-surface text-text transition-colors duration-150 hover:bg-surface-2 disabled:opacity-30 touch-manipulation sm:h-[4.5rem]'
  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Escrever o ritmo">
      <div className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
        {cells.map((id, i) => (
          <button key={id} type="button" disabled={disabled || !fits(id)} onClick={() => onAdd(id)} className={btn} aria-label={`figura ${i + 1}`}>
            <FigureGlyph events={cellEvents(id)} className="h-12 sm:h-14" />
            <span className="pointer-events-none absolute right-1.5 bottom-1 hidden font-mono text-[10px] text-sub sm:block">{i + 1}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        <button type="button" disabled={disabled} onClick={onErase} className={cx(btn, 'h-12 text-sm sm:h-12')}>
          apagar <span className="ml-2 hidden sm:inline"><Kbd>⌫</Kbd></span>
        </button>
        <button type="button" disabled={disabled} onClick={onReplay} className={cx(btn, 'h-12 text-sm sm:h-12')}>
          ouvir de novo <span className="ml-2 hidden sm:inline"><Kbd>R</Kbd></span>
        </button>
        <button
          type="button"
          disabled={disabled || !canCheck}
          onClick={onCheck}
          className={cx(btn, 'h-12 text-sm sm:h-12', canCheck && !disabled && 'bg-accent text-accent-ink hover:bg-accent hover:brightness-110')}
        >
          conferir <span className="ml-2 hidden sm:inline"><Kbd>Enter</Kbd></span>
        </button>
      </div>
    </div>
  )
}
