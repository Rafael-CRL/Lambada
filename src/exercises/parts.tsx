import type { ReactNode } from 'react'
import { Fretboard } from '../staff/Fretboard'
import { cx } from '../ui/controls'
import { IconBulb } from '../ui/icons'
import type { Feedback, FretFeedback } from './controller'

/** Retorno sob a pauta: o nome certo no erro, o lugar da nota nova, "certo!". */
export function FeedbackLine({ fb, infoTone = 'accent' }: { fb: Feedback | null; infoTone?: 'accent' | 'sub' }) {
  return (
    <div className="flex min-h-16 flex-col items-center justify-start gap-0.5 text-center" aria-live="polite">
      {fb && (fb.kind !== 'ok' || fb.text) && (
        <div key={fb.key} className="animate-fade-in">
          <div
            className={cx(
              'text-2xl font-semibold',
              fb.kind === 'ok' && 'text-ok',
              fb.kind === 'err' && 'text-err',
              fb.kind === 'oct' && 'text-oct',
              fb.kind === 'info' && (infoTone === 'accent' ? 'text-accent' : 'text-sub'),
            )}
          >
            {fb.text}
          </div>
          {fb.detail && <div className="text-sm text-sub">{fb.detail}</div>}
        </div>
      )}
    </div>
  )
}

/** Dica depois de muitos erros: discreta, sem bloquear. */
export function TipLine({ text }: { text: string }) {
  return (
    <div key={text} className="mx-auto flex max-w-lg animate-fade-in items-start gap-2.5 rounded-lg bg-surface px-4 py-2.5 text-left text-sm leading-snug text-text" role="status">
      <IconBulb className="mt-0.5 shrink-0 text-base text-accent" />
      <span>{text}</span>
    </div>
  )
}

/** Violão: onde fica a nota certa (e a tocada, se errou). */
export function FretHint({ fret }: { fret: FretFeedback }) {
  return (
    <div className="mx-auto mt-2 w-full max-w-sm animate-fade-in">
      <Fretboard
        toFret={Math.max(5, fret.target.fret, fret.played?.fret ?? 0)}
        ariaLabel={`Nota certa ${fret.targetName}${fret.playedName ? `; tocada ${fret.playedName}` : ''}`}
        markers={[...(fret.played ? [{ position: fret.played, kind: 'played' as const }] : []), { position: fret.target, kind: 'target' as const }]}
      />
      <div className="mt-1 flex justify-center gap-4 text-xs text-sub">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-ok" /> {fret.targetName}
        </span>
        {fret.playedName && (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-err" /> tocada {fret.playedName}
          </span>
        )}
      </div>
    </div>
  )
}

/** Contagem grande antes do metrônomo começar. */
export function Countdown({ value }: { value: string | null }) {
  if (!value) return null
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <span key={value} className="animate-pop font-mono text-7xl font-semibold text-accent/80">
        {value}
      </span>
    </div>
  )
}

/** Cartão sobre a pauta, entre as partes de um exercício: qualquer tecla segue. */
export function PartCard({
  title,
  detail,
  onClick,
  children,
  hint = 'qualquer tecla para seguir',
}: {
  title: string
  detail?: string
  onClick: () => void
  children?: ReactNode
  hint?: string
}) {
  return (
    <button type="button" onClick={onClick} className="absolute inset-0 z-10 grid animate-fade-in place-items-center bg-bg/80 backdrop-blur-[2px]">
      <span className="flex flex-col items-center gap-1 px-4">
        <span className="text-3xl font-semibold tracking-tight">{title}</span>
        {detail && <span className="text-sub">{detail}</span>}
        {children}
        <span className="mt-3 text-xs text-sub">{hint}</span>
      </span>
    </button>
  )
}

/**
 * Bloco central de um exercício: numa tela grande, pauta e botões juntos no
 * meio (perto do olho e do mouse); no celular, botões no rodapé (polegar).
 */
export function ExerciseBody({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto sm:justify-center-safe">
      <div className="relative flex flex-col justify-center-safe max-sm:flex-1">{children}</div>
      <footer className="mt-2 flex flex-col gap-3">{footer}</footer>
    </div>
  )
}
