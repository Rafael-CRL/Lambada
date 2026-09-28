import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from './controls'

export interface Choice<T> {
  value: T
  label: ReactNode
  /** tecla de atalho (um caractere, ex.: "1") */
  hotkey: string
  aria?: string
}

/**
 * Botões de resposta com atalho no teclado, no mesmo desenho dos botões de
 * nota: o botão pisca verde no acerto e vermelho no erro.
 */
export function ChoiceButtons<T>({
  choices,
  onChoose,
  disabled,
  label,
}: {
  choices: Choice<T>[]
  /** devolve o acerto (para o botão piscar) ou null se a resposta foi ignorada */
  onChoose: (v: T, timeStamp: number) => boolean | null
  disabled?: boolean
  label: string
}) {
  const [flash, setFlash] = useState<{ i: number; ok: boolean; n: number } | null>(null)
  const timer = useRef<number | null>(null)
  const press = (i: number, timeStamp: number) => {
    if (disabled) return
    const ok = onChoose(choices[i].value, timeStamp)
    if (ok === null) return
    setFlash((f) => ({ i, ok, n: (f?.n ?? 0) + 1 }))
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setFlash(null), 320)
  }
  const pressRef = useRef(press)
  pressRef.current = press

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const i = choices.findIndex((c) => c.hotkey === e.key.toLowerCase())
      if (i < 0) return
      e.preventDefault()
      pressRef.current(i, e.timeStamp)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choices])

  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), [])

  return (
    <div className="grid w-full gap-1.5 sm:gap-2" style={{ gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))` }} role="group" aria-label={label}>
      {choices.map((c, i) => {
        const f = flash?.i === i ? flash : null
        return (
          <button
            key={f ? `${i}-${f.n}` : i}
            type="button"
            disabled={disabled}
            aria-label={c.aria}
            onPointerDown={(e) => {
              if (e.button !== 0) return
              e.preventDefault()
              press(i, e.timeStamp)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                press(i, e.timeStamp)
              }
            }}
            className={cx(
              'relative flex h-16 flex-col items-center justify-center rounded-xl text-lg font-medium select-none transition-colors duration-150 touch-manipulation disabled:opacity-40 sm:h-[4.5rem] sm:text-xl',
              !f && 'bg-surface text-text hover:bg-surface-2',
              f?.ok === true && 'animate-pop bg-ok text-accent-ink',
              f?.ok === false && 'animate-shake bg-err text-accent-ink',
            )}
          >
            {c.label}
            <span className="pointer-events-none absolute right-1.5 bottom-1 hidden font-mono text-[10px] text-sub sm:block">{c.hotkey}</span>
          </button>
        )
      })}
    </div>
  )
}
