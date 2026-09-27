import { useEffect, useRef, useState, type ReactNode } from 'react'
import { RHYTHM_LEVELS } from '../domain/rhythm'
import { SCALE_LABELS, type ScaleId } from '../domain/scales'
import { cx, Segmented, Stepper } from '../ui/controls'
import { IconFrets, IconHourglass, IconMetronome, IconSpeaker } from '../ui/icons'
import { TIMED_SECONDS, type Control, type Duration, type ExerciseConfig, type Tempo, type Timbre } from './types'

export interface OptionChange {
  tempo?: Tempo
  bpm?: number
  level?: number
  duration?: Duration
  timbre?: Timbre
  accidentals?: boolean
  scale?: ScaleId
}

/**
 * Ajustes da atividade: ícones discretos no canto; cada um abre um balão
 * pequeno. Nada disso precisa ser decidido antes de começar.
 */
export function ControlsDock({
  controls,
  config,
  onChange,
  onOpenChange,
}: {
  controls: Control[]
  config: ExerciseConfig
  onChange: (c: OptionChange) => void
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState<Control | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => onOpenChange?.(open !== null), [open, onOpenChange])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        setOpen(null)
      }
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const button = (c: Control, label: string, icon: ReactNode) => (
    <button
      key={c}
      type="button"
      aria-label={label}
      title={label}
      aria-expanded={open === c}
      onClick={() => setOpen(open === c ? null : c)}
      className={cx(
        'grid size-10 place-items-center rounded-lg text-lg transition-colors duration-150',
        open === c ? 'bg-surface-2 text-text' : 'text-sub hover:bg-surface hover:text-text',
      )}
    >
      {icon}
    </button>
  )

  const level = RHYTHM_LEVELS.find((l) => l.level === config.level) ?? RHYTHM_LEVELS[0]

  return (
    <div ref={ref} className="relative flex items-center gap-0.5">
      {open && (
        <div className="absolute right-0 bottom-full z-30 mb-2 flex w-max max-w-[calc(100vw-2rem)] animate-fade-in flex-col gap-4 rounded-xl border border-line/60 bg-surface p-4 shadow-xl shadow-black/20">
          {open === 'tempo' && (
            <>
              <Segmented<Tempo>
                label="Tempo"
                value={config.tempo}
                onChange={(tempo) => onChange({ tempo })}
                options={[
                  { value: 'free', label: 'Livre' },
                  { value: 'metronome', label: 'Metrônomo' },
                ]}
              />
              {config.tempo === 'metronome' && (
                <>
                  <Stepper label="BPM" value={config.bpm} min={30} max={200} step={5} format={(v) => `${v} bpm`} onChange={(bpm) => onChange({ bpm })} />
                  {config.content === 'random' && (
                    <div className="flex flex-col gap-1.5">
                      <Segmented<string>
                        size="sm"
                        label="Figuras"
                        value={String(config.level)}
                        onChange={(v) => onChange({ level: Number(v) })}
                        options={RHYTHM_LEVELS.map((l) => ({ value: String(l.level), label: String(l.level) }))}
                      />
                      <span className="text-xs text-sub">figuras: {level.label}</span>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {open === 'bpm' && (
            <Stepper label="BPM" value={config.bpm} min={30} max={200} step={5} format={(v) => `${v} bpm`} onChange={(bpm) => onChange({ bpm })} />
          )}
          {open === 'duration' && (
            <Segmented<Duration>
              label="Duração"
              value={config.duration}
              onChange={(duration) => onChange({ duration })}
              options={[
                { value: 'infinite', label: '∞' },
                { value: 'short', label: '8 comp.' },
                { value: 'long', label: '16' },
                ...(config.tempo === 'free' ? [{ value: 'timed' as const, label: `${TIMED_SECONDS} s` }] : []),
              ]}
            />
          )}
          {open === 'sound' && (
            <Segmented<Timbre>
              label="Som"
              value={config.timbre}
              onChange={(timbre) => onChange({ timbre })}
              options={[
                { value: 'piano', label: 'Piano' },
                { value: 'guitar', label: 'Violão' },
                { value: 'off', label: 'Mudo' },
              ]}
            />
          )}
          {open === 'accidentals' && (
            <Segmented<string>
              label="Acidentes"
              value={config.accidentals ? 'on' : 'off'}
              onChange={(v) => onChange({ accidentals: v === 'on' })}
              options={[
                { value: 'off', label: 'Naturais' },
                { value: 'on', label: 'Com ♯ ♭' },
              ]}
            />
          )}
          {open === 'region' && (
            <Segmented<ScaleId>
              label="Região"
              value={config.scale}
              onChange={(scale) => onChange({ scale })}
              options={(['solta', 'fechada'] as const).map((v) => ({ value: v, label: SCALE_LABELS[v] }))}
            />
          )}
        </div>
      )}
      {controls.map((c) => {
        switch (c) {
          case 'tempo':
            return button(c, 'Tempo', <IconMetronome />)
          case 'bpm':
            return button(c, 'Andamento', <IconMetronome />)
          case 'duration':
            return button(c, 'Duração', <IconHourglass />)
          case 'sound':
            return button(c, 'Som', <IconSpeaker />)
          case 'accidentals':
            return button(c, 'Acidentes', <span className="font-serif text-base leading-none">♯♭</span>)
          case 'region':
            return button(c, 'Região do braço', <IconFrets />)
        }
      })}
    </div>
  )
}
