import { useEffect, useRef } from 'react'
import type { Microphone } from '../audio/microphone'
import { defaultSpelling, namePtOctave, writtenFromSounding } from '../domain/notes'
import { IconMic } from '../ui/icons'

/**
 * Indicador ao vivo: nível de entrada, nota captada (grafia escrita) e
 * desvio em cents. Atualizado por rAF direto no DOM.
 */
export function MicMeter({ mic }: { mic: Microphone }) {
  const bar = useRef<HTMLDivElement>(null)
  const note = useRef<HTMLSpanElement>(null)
  const needle = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let id = 0
    let lastText = ''
    const tick = () => {
      id = requestAnimationFrame(tick)
      const live = mic.live
      if (bar.current) bar.current.style.transform = `scaleX(${live.level.toFixed(3)})`
      const midi = live.midi
      const text = midi === null ? '' : namePtOctave(writtenFromSounding(defaultSpelling(Math.round(midi))))
      if (text !== lastText && note.current) {
        note.current.textContent = text || '—'
        note.current.style.opacity = text ? '1' : '0.4'
        lastText = text
      }
      if (needle.current) {
        const cents = midi === null ? 0 : (midi - Math.round(midi)) * 100
        needle.current.style.transform = `translateX(${((cents / 50) * 48).toFixed(1)}px)`
        needle.current.style.opacity = midi === null ? '0' : '1'
      }
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [mic])

  return (
    <div className="flex w-full items-center gap-4 rounded-xl bg-surface/60 px-4 py-3" aria-label="Entrada do microfone">
      <IconMic className="shrink-0 text-xl text-sub" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div ref={bar} className="h-full w-full origin-left rounded-full bg-accent" style={{ transform: 'scaleX(0)' }} />
        </div>
        <div className="relative mx-auto h-1.5 w-24">
          <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
          <div ref={needle} className="absolute inset-y-0 left-1/2 -ml-1 w-2 rounded-full bg-sub opacity-0 transition-transform duration-75" />
        </div>
        <span className="truncate text-xs text-sub">{mic.label}</span>
      </div>
      <span ref={note} className="tabular w-16 text-right font-mono text-2xl opacity-40" aria-live="off">
        —
      </span>
    </div>
  )
}
