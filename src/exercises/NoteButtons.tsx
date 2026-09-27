import { useEffect, useRef, useState } from 'react'
import { isAllowedSpelling, LETTERS, namePt, spellingId, type Accidental, type Letter } from '../domain/notes'
import type { AttemptResult } from '../engine/adaptive'
import { cx } from '../ui/controls'
import type { Spelling } from './controller'

/** Teclado espelha as três fileiras: QWERTY = ♯, ASDF = naturais, ZXCV = ♭. */
const KEYS: Record<Accidental, string[]> = {
  1: ['q', 'w', 'e', 'r', 't', 'y', 'u'],
  0: ['a', 's', 'd', 'f', 'g', 'h', 'j'],
  [-1]: ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
}

function keyFor(letter: Letter, acc: Accidental): string {
  return KEYS[acc][LETTERS.indexOf(letter)]
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
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key.toLowerCase()
      for (const acc of (accidentals ? [1, 0, -1] : [0]) as Accidental[]) {
        const idx = KEYS[acc].indexOf(k)
        if (idx < 0) continue
        const letter = LETTERS[idx]
        if (!isAllowedSpelling(letter, acc)) return
        e.preventDefault()
        pressRef.current({ letter, acc }, e.timeStamp)
        return
      }
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
                <span className="pointer-events-none absolute right-1.5 bottom-1 hidden font-mono text-[10px] text-sub uppercase sm:block">
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
