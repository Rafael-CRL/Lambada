import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'ghost' | 'surface'

export function Button({
  variant = 'surface',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors duration-150 disabled:opacity-40',
        variant === 'primary' && 'bg-accent text-accent-ink hover:brightness-110',
        variant === 'surface' && 'bg-surface text-text hover:bg-surface-2',
        variant === 'ghost' && 'text-sub hover:bg-surface hover:text-text',
        className,
      )}
      {...rest}
    />
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  label: string
  size?: 'sm' | 'md'
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors duration-150',
            size === 'sm' ? 'min-h-8 px-3 text-xs' : 'min-h-10 px-4 text-sm',
            o.value === value ? 'bg-surface-2 text-text' : 'text-sub hover:text-text',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-150',
        checked ? 'bg-accent' : 'bg-surface-2',
      )}
    >
      <span
        className={cx(
          'inline-block size-5 rounded-full shadow transition-transform duration-150',
          checked ? 'translate-x-6 bg-accent-ink' : 'translate-x-1 bg-sub',
        )}
      />
    </button>
  )
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  format = (v) => String(v),
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  label: string
  format?: (v: number) => string
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v / step) * step)))
  return (
    <div className="inline-flex items-center rounded-lg bg-surface p-1" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`diminuir ${label}`}
        disabled={value <= min}
        onClick={() => set(value - step)}
        className="size-9 rounded-md text-lg text-sub hover:bg-surface-2 hover:text-text disabled:opacity-30"
      >
        −
      </button>
      <output className="tabular min-w-16 text-center font-mono text-sm" aria-live="polite">
        {format(value)}
      </output>
      <button
        type="button"
        aria-label={`aumentar ${label}`}
        disabled={value >= max}
        onClick={() => set(value + step)}
        className="size-9 rounded-md text-lg text-sub hover:bg-surface-2 hover:text-text disabled:opacity-30"
      >
        +
      </button>
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] leading-none text-sub">{children}</kbd>
  )
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cx('h-1 w-full overflow-hidden rounded-full bg-surface', className)}>
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      />
    </div>
  )
}
