import { useEffect, useRef, useState, type ReactNode } from 'react'
import { RHYTHM_LEVELS, type Meter } from '../domain/rhythm'
import { NOTE_SET_LABELS, SCALE_LABELS, type NoteSet, type ScaleId } from '../domain/scales'
import { cx, Segmented, Stepper } from '../ui/controls'
import { IconFrets, IconHourglass, IconLines, IconMetronome, IconNote, IconSpeaker, IconStaffMap } from '../ui/icons'
import { ALL_STRINGS, TIMED_SECONDS, type Control, type Duration, type ExerciseConfig, type Tempo, type Timbre } from './types'

export interface OptionChange {
  tempo?: Tempo
  bpm?: number
  level?: number
  duration?: Duration
  timbre?: Timbre
  accidentals?: boolean
  scale?: ScaleId
  notes?: NoteSet
  strings?: number[]
  meter?: Meter
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
  mapOpen = false,
  onToggleMap,
}: {
  controls: Control[]
  config: ExerciseConfig
  onChange: (c: OptionChange) => void
  onOpenChange?: (open: boolean) => void
  /** cola das notas: liga/desliga direto, sem balão */
  mapOpen?: boolean
  onToggleMap?: () => void
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
                // tempo livre não tem compasso: 8 compassos = 32 notas
                { value: 'short', label: config.tempo === 'free' ? '32 notas' : '8 comp.' },
                { value: 'long', label: config.tempo === 'free' ? '64' : '16' },
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
          {open === 'figures' && (
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
          {open === 'meter' && (
            <Segmented<string>
              label="Compasso"
              value={String(config.meter ?? 4)}
              onChange={(v) => onChange({ meter: Number(v) as Meter })}
              options={['2', '3', '4'].map((v) => ({ value: v, label: `${v}/4` }))}
            />
          )}
          {open === 'notes' && (
            <Segmented<NoteSet>
              label="Notas"
              value={config.notes ?? 'todas'}
              onChange={(notes) => onChange({ notes })}
              options={(['pauta', 'suplementares', 'todas'] as const).map((v) => ({ value: v, label: NOTE_SET_LABELS[v] }))}
            />
          )}
          {open === 'strings' && <StringsPicker value={config.strings ?? ALL_STRINGS} onChange={(strings) => onChange({ strings })} />}
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
          case 'map':
            return (
              <button
                key={c}
                type="button"
                aria-label="Notas da pauta"
                title={mapOpen ? 'Ocultar as notas da pauta' : 'Mostrar as notas de cada linha e espaço'}
                aria-pressed={mapOpen}
                onClick={() => {
                  // fecha qualquer balão aberto para não cobrir a cola
                  setOpen(null)
                  onToggleMap?.()
                }}
                className={cx(
                  'grid size-10 place-items-center rounded-lg transition-colors duration-150',
                  mapOpen ? 'bg-accent text-accent-ink' : 'text-sub hover:bg-surface hover:text-text',
                )}
              >
                <IconStaffMap />
              </button>
            )
          case 'region':
            return button(c, 'Região do braço', <IconFrets />)
          case 'notes':
            return button(c, 'Notas', <IconLines />)
          case 'strings':
            return button(c, 'Cordas', <IconFrets />)
          case 'figures':
            return button(c, 'Figuras', <IconNote />)
          case 'meter':
            return button(c, 'Compasso', <span className="font-mono text-xs leading-none">{config.meter ?? 4}/4</span>)
        }
      })}
    </div>
  )
}

/**
 * Cordas do violão. Com todas ligadas, tocar numa escolhe só ela (o caso
 * comum: treinar uma corda); depois cada toque liga ou desliga (pelo menos
 * uma fica). "todas" volta ao braço inteiro.
 */
function StringsPicker({ value, onChange }: { value: number[]; onChange: (strings: number[]) => void }) {
  const all = value.length === ALL_STRINGS.length
  const toggle = (n: number) => {
    if (all) return onChange([n])
    const next = value.includes(n) ? value.filter((s) => s !== n) : [...value, n].sort((a, b) => a - b)
    if (next.length) onChange(next)
  }
  const item = (pressed: boolean, label: string) =>
    cx('min-h-10 rounded-md px-3 text-sm font-medium transition-colors duration-150', pressed ? 'bg-surface-2 text-text' : 'text-sub hover:text-text', label)
  return (
    <div className="flex flex-col gap-1.5">
      <div role="group" aria-label="Cordas" className="inline-flex gap-0.5 rounded-lg bg-surface p-1">
        {ALL_STRINGS.map((n) => (
          <button key={n} type="button" aria-pressed={!all && value.includes(n)} onClick={() => toggle(n)} className={item(!all && value.includes(n), 'tabular')}>
            {n}ª
          </button>
        ))}
        <button type="button" aria-pressed={all} onClick={() => onChange(ALL_STRINGS)} className={item(all, '')}>
          todas
        </button>
      </div>
      <span className="text-xs text-sub">cordas: {all ? 'todas' : value.map((n) => `${n}ª`).join(', ')}</span>
    </div>
  )
}
