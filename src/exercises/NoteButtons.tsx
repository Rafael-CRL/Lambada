import { useEffect, useRef, useState } from 'react'
import { isAllowedSpelling, LETTERS, namePt, spellingId, type Accidental, type Letter } from '../domain/notes'
import type { AttemptResult } from '../engine/adaptive'
import { cx } from '../ui/controls'
import type { Spelling } from './controller'

/**
 * Atalhos pelas letras das notas: C D E F G A B. Shift + letra = sustenido,
 * Alt + letra = bemol. Lê `code` (tecla física) para funcionar com modificadores.
 */
function keyFor(letter: Letter, acc: Accidental): string {
  return acc === 1 ? `⇧${letter}` : acc === -1 ? `alt ${letter}` : letter
}

function fromKey(e: KeyboardEvent): { letter: Letter; acc: Accidental } | null {
  const m = /^Key([A-G])$/.exec(e.code)
  if (!m || e.ctrlKey || e.metaKey) return null
  if (e.shiftKey && e.altKey) return null
  const acc: Accidental = e.shiftKey ? 1 : e.altKey ? -1 : 0
  return { letter: m[1] as Letter, acc }
}

export function NoteButtons({
  accidentals,
  onAnswer,
  disabled,
}: {
  accidentals: boolean
  onAnswer: (s: Spelling, timeStamp: number) => AttemptResult | null
  disabled?: boolean
}) {
  const [flash, setFlash] = useState<{ id: string; result: AttemptResult; n: number } | null>(null)
  const timer = useRef<number | null>(null)
  const onAnswerRef = useRef(onAnswer)
  onAnswerRef.current = onAnswer

  const press = (s: Spelling, timeStamp: number) => {
    if (disabled) return
    const result = onAnswerRef.current(s, timeStamp)
    if (!result) return
    setFlash((f) => ({ id: spellingId(s), result, n: (f?.n ?? 0) + 1 }))
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setFlash(null), 260)
  }
  const pressRef = useRef(press)
  pressRef.current = press

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const k = fromKey(e)
      if (!k) return
      // Alt sozinho abriria menus do navegador: sempre consumido aqui
      e.preventDefault()
      if (k.acc !== 0 && !accidentals) return
      if (!isAllowedSpelling(k.letter, k.acc)) return
      pressRef.current(k, e.timeStamp)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [accidentals])

  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), [])

  const rows: Accidental[] = accidentals ? [1, 0, -1] : [0]
  return (
    <div className="grid w-full gap-2" role="group" aria-label="Responder nota">
      {rows.map((acc) => (
        <div key={acc} className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {LETTERS.map((letter) => {
            if (!isAllowedSpelling(letter, acc)) return <span key={letter} aria-hidden="true" />
            const id = spellingId({ letter, acc })
            const f = flash?.id === id ? flash : null
            return (
              <button
                key={f ? `${letter}-${f.n}` : letter}
                type="button"
                disabled={disabled}
                onPointerDown={(e) => {
                  if (e.button !== 0) return
                  e.preventDefault()
                  press({ letter, acc }, e.timeStamp)
                }}
                onKeyDown={(e) => {
                  // Enter/espaço com foco no botão
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    press({ letter, acc }, e.timeStamp)
                  }
                }}
                className={cx(
                  'relative flex flex-col items-center justify-center rounded-xl font-medium select-none transition-colors duration-150 touch-manipulation disabled:opacity-40',
                  acc === 0 ? 'h-16 text-lg sm:h-[4.5rem] sm:text-xl' : 'h-12 text-base sm:h-14',
                  !f && (acc === 0 ? 'bg-surface text-text hover:bg-surface-2' : 'bg-surface/60 text-text hover:bg-surface-2'),
                  f?.result === 'correct' && 'animate-pop bg-ok text-accent-ink',
                  f?.result === 'wrong' && 'animate-shake bg-err text-accent-ink',
                  f?.result === 'wrong-octave' && 'animate-shake bg-oct text-accent-ink',
                )}
              >
                <span>{namePt({ letter, acc })}</span>
                <span className="pointer-events-none absolute right-1.5 bottom-1 hidden font-mono text-[10px] text-sub sm:block">
                  {keyFor(letter, acc)}
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
