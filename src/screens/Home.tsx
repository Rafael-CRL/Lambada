import { useLiveQuery } from 'dexie-react-hooks'
import type { ReactNode } from 'react'
import { navigate } from '../app/router'
import { micSupported } from '../audio/microphone'
import { db, getLastExercise, saveSettings, type Settings } from '../db/db'
import { namePt, sameNote } from '../domain/notes'
import { SCALE_LABELS } from '../domain/scales'
import type { InputKind } from '../engine/adaptive'
import { startExercise } from '../exercises/start'
import { exerciseSubtitle, exerciseTitle, type ExerciseConfig } from '../exercises/types'
import { StaffSvg } from '../staff/StaffSvg'
import { Button, cx, Segmented } from '../ui/controls'
import { IconArrowRight, IconKeys, IconMic, IconTrophy } from '../ui/icons'
import { useProgressSnapshot } from './useProgress'

export function Home({ settings }: { settings: Settings }) {
  const last = useLiveQuery(getLastExercise, [], null)
  const input = settings.readingInput
  const lastSession = useLiveQuery(() => db.sessions.orderBy('startedAt').filter((s) => s.completed !== false).last(), [])
  const record = useLiveQuery(() => db.records.get(`${input}:${settings.bpm}`), [input, settings.bpm])
  const snapshot = useProgressSnapshot(settings, input)
  const mic = micSupported()

  const go = (config: ExerciseConfig) => () => startExercise(config)

  return (
    <div className="flex flex-col gap-8">
      {last && (
        <button
          type="button"
          onClick={go(last)}
          className="group flex w-full items-center justify-between gap-4 rounded-xl border border-accent/40 bg-accent/10 px-5 py-4 text-left transition-colors duration-150 hover:bg-accent/15"
        >
          <span className="flex flex-col">
            <span className="text-xs font-medium tracking-wide text-accent uppercase">continuar</span>
            <span className="text-lg font-medium">
              {exerciseTitle(last)} <span className="text-sub">· {exerciseSubtitle(last)}</span>
            </span>
          </span>
          <IconArrowRight className="text-2xl text-accent transition-transform duration-150 group-hover:translate-x-1" />
        </button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-sub">entrada</span>
          <Segmented<InputKind>
            label="Entrada para leitura e BPM"
            value={input}
            onChange={(v) => saveSettings({ readingInput: v })}
            options={[
              { value: 'buttons', label: <><IconKeys /> botões</> },
              { value: 'mic', label: <><IconMic /> microfone</> },
            ]}
          />
        </div>
        <a href="#/settings" className="rounded-md text-sm text-sub hover:text-text">
          escala <span className="text-text">{SCALE_LABELS[settings.scale]}</span> ·{' '}
          {settings.accidentals ? 'com acidentes' : 'naturais'}
        </a>
      </div>

      {input === 'mic' && !mic && (
        <p className="rounded-lg bg-err/10 px-4 py-3 text-sm text-err">
          Este navegador não dá acesso ao microfone aqui. Use http://localhost ou HTTPS.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <ModeCard title="Esteira" description="As notas vêm rolando até a linha. Leia e responda.">
          <Button variant="primary" className="flex-1" onClick={go({ kind: 'conveyor', flow: 'wait', input })}>
            Espera
          </Button>
          <Button variant="primary" className="flex-1" onClick={go({ kind: 'conveyor', flow: 'continuous', input })}>
            Contínua
          </Button>
        </ModeCard>

        <ModeCard title="Sprint" description="60 segundos, uma nota por vez. Quantas você acerta?">
          <Button variant="primary" className="flex-1" onClick={go({ kind: 'sprint', input })}>
            Começar
          </Button>
        </ModeCard>

        <ModeCard
          title="Pauta → violão"
          badge={<><IconMic /> microfone</>}
          description="Leia a nota e toque no violão. O app confere pelo som, oitava exata."
        >
          <Button variant="primary" className="flex-1 px-2" onClick={go({ kind: 'guitar', drill: 'repeat' })} disabled={!mic}>
            Repetição
          </Button>
          <Button variant="primary" className="flex-1 px-2" onClick={go({ kind: 'guitar', drill: 'scale' })} disabled={!mic}>
            Escala
          </Button>
          <Button variant="primary" className="flex-1 px-2" onClick={go({ kind: 'guitar', drill: 'adaptive' })} disabled={!mic}>
            Adaptativo
          </Button>
        </ModeCard>

        <ModeCard
          title="BPM"
          badge={
            <span className="tabular font-mono">
              {settings.bpm} bpm
              {record && (
                <span className="ml-2 text-accent">
                  <IconTrophy className="inline align-[-2px]" /> {record.score}
                </span>
              )}
            </span>
          }
          description="Semínimas no tempo do metrônomo. Nota certa e na hora certa."
        >
          <Button variant="primary" className="flex-1" onClick={go({ kind: 'bpm', input })}>
            Começar
          </Button>
        </ModeCard>
      </div>

      {snapshot && (
        <section className="flex flex-col gap-3 rounded-xl bg-surface/60 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium text-sub">
              notas liberadas · <span className="text-text">{snapshot.active.length}</span>
              <span className="text-sub">/{snapshot.items.length}</span>
              <span className="mx-2">·</span>
              dominadas · <span className="text-text">{snapshot.mastered.size}</span>
            </h2>
            {lastSession && (
              <span className="text-sm text-sub">
                última sessão{' '}
                <span className="tabular font-mono text-text">
                  {Math.round((lastSession.correct / lastSession.attempts) * 100)}%
                </span>
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <StaffSvg
              className="h-24 min-w-full"
              spacing={34}
              ariaLabel="Notas liberadas"
              notes={[...snapshot.active]
                .sort((a, b) => a.midi - b.midi || b.written.acc - a.written.acc)
                .filter((n, i, arr) => i === 0 || !sameNote(n.written, arr[i - 1].written))
                .map((i) => ({
                  key: i.id,
                  note: i.written,
                  className: cx(!snapshot.mastered.has(i.id) && 'is-muted'),
                  title: `${namePt(i.written)} ${snapshot.mastered.has(i.id) ? '· dominada' : ''}`,
                }))}
            />
          </div>
          <a href="#/progress" onClick={(e) => (e.preventDefault(), navigate({ name: 'progress' }))} className="self-start rounded-md text-sm text-sub hover:text-text">
            ver progresso →
          </a>
        </section>
      )}
    </div>
  )
}

function ModeCard({
  title,
  description,
  badge,
  children,
}: {
  title: string
  description: string
  badge?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl bg-surface/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {badge && <span className="inline-flex items-center gap-1.5 text-xs text-sub">{badge}</span>}
      </div>
      <p className="-mt-2 text-sm leading-relaxed text-sub">{description}</p>
      <div className="mt-auto flex gap-2">{children}</div>
    </section>
  )
}
