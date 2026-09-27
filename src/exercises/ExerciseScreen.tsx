import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { navigate } from '../app/router'
import { ensureAudioRunning, isAudioRunning } from '../audio/clock'
import { Microphone } from '../audio/microphone'
import { db, DEFAULT_SETTINGS, loadSettings, type SessionRecord, type Settings } from '../db/db'
import { StudySession } from '../engine/session'
import { Fretboard } from '../staff/Fretboard'
import { Button, cx, Kbd, ProgressBar } from '../ui/controls'
import { IconPause, IconPlay, IconRedo, IconX } from '../ui/icons'
import { BpmController } from './bpm'
import { EMPTY_HUD, type Controller, type ControllerDeps, type Hud } from './controller'
import { ConveyorController } from './conveyor'
import { GuitarController } from './guitar'
import { MicMeter } from './MicMeter'
import { NoteButtons } from './NoteButtons'
import { SprintController } from './sprint'
import { StaffStage } from './stage'
import { startExercise } from './start'
import { exerciseSubtitle, exerciseTitle, inputOf, type ExerciseConfig } from './types'

type Phase = 'loading' | 'needs-gesture' | 'mic-error' | 'running' | 'paused'

function createController(deps: ControllerDeps): Controller {
  const c = deps.config
  switch (c.kind) {
    case 'conveyor':
      return new ConveyorController(deps, c.flow)
    case 'sprint':
      return new SprintController(deps)
    case 'guitar':
      return new GuitarController(deps, c.drill)
    case 'bpm':
      return new BpmController(deps)
  }
}

async function saveResult(session: StudySession, completed: boolean, extra?: Partial<SessionRecord>): Promise<SessionRecord | null> {
  const rec = await session.finish(completed, extra)
  if (rec && completed && rec.score !== undefined && rec.bpm !== undefined) {
    const id = `${rec.input}:${rec.bpm}`
    const prev = await db.records.get(id)
    if (!prev || rec.score > prev.score) {
      await db.records.put({ id, input: rec.input, bpm: rec.bpm, score: rec.score, at: rec.endedAt })
    }
  }
  return rec
}

export function ExerciseScreen({ config: configProp }: { config: ExerciseConfig }) {
  // a rota recria o objeto a cada render; estabiliza pelo conteúdo
  const configKey = JSON.stringify(configProp)
  const config = useMemo(() => configProp, [configKey])
  const input = inputOf(config)
  const svgRef = useRef<SVGSVGElement>(null)
  const ctrl = useRef<Controller | null>(null)
  const sessionRef = useRef<StudySession | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [mic, setMic] = useState<Microphone | null>(null)
  const [micError, setMicError] = useState('')
  const [hud, setHudState] = useState<Hud>(EMPTY_HUD)
  const setHud = useCallback((patch: Partial<Hud>) => setHudState((h) => ({ ...h, ...patch })), [])
  // configurações lidas (e congeladas) no início do exercício
  const [frozen, setFrozen] = useState<Settings>(DEFAULT_SETTINGS)

  useEffect(() => {
    let cancelled = false
    let openedMic: Microphone | null = null
    let stage: StaffStage | null = null
    let controller: Controller | null = null
    let session: StudySession | null = null
    let done = false

    const boot = async () => {
      const frozen = await loadSettings()
      if (cancelled) return
      setFrozen(frozen)
      session = await StudySession.open(config, frozen.scale, frozen.accidentals)
      if (cancelled) return
      sessionRef.current = session
      if (input === 'mic') {
        try {
          openedMic = await Microphone.open(frozen.audioDeviceId, frozen.latencyMs)
        } catch (e) {
          if (cancelled) return
          setMicError(e instanceof Error ? `${e.name}: ${e.message}` : String(e))
          setPhase('mic-error')
          return
        }
        if (cancelled) return openedMic.close()
        setMic(openedMic)
      }
      stage = new StaffStage(svgRef.current!, { hitX: config.kind === 'sprint' ? undefined : 90 })
      controller = createController({
        config,
        settings: frozen,
        session,
        mic: openedMic,
        stage,
        setHud,
        finish: (extra) => {
          done = true
          void saveResult(session!, true, extra).then((rec) => {
            if (rec?.id !== undefined) navigate({ name: 'summary', id: rec.id }, true)
            else navigate({ name: 'home' }, true)
          })
        },
      })
      ctrl.current = controller
      if (import.meta.env.DEV) (window as unknown as { __lambada: unknown }).__lambada = { controller, session }
      if (isAudioRunning() || (await ensureAudioRunning())) {
        if (cancelled) return
        controller.start()
        setPhase('running')
      } else setPhase('needs-gesture')
    }
    void boot()

    return () => {
      cancelled = true
      controller?.dispose()
      stage?.dispose()
      openedMic?.close()
      ctrl.current = null
      // saída no meio: guarda o que já foi feito
      if (session && !done) void saveResult(session, false)
    }
  }, [config, input, setHud])

  const togglePause = useCallback(() => {
    const c = ctrl.current
    if (!c) return
    if (phase === 'running') {
      c.pause()
      setPhase('paused')
    } else if (phase === 'paused') {
      c.resume()
      setPhase('running')
    }
  }, [phase])

  const beginAfterGesture = async () => {
    if (await ensureAudioRunning()) {
      ctrl.current?.start()
      setPhase('running')
    }
  }

  const exit = () => navigate({ name: 'home' }, true)
  const restart = () => startExercise(config, true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (phase === 'paused') exit()
        else togglePause()
      } else if (e.key === ' ' && (phase === 'paused' || phase === 'running') && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        togglePause()
      } else if (e.key === 'Enter' && phase === 'needs-gesture') {
        void beginAfterGesture()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const fb = hud.feedback
  return (
    <div className="mx-auto flex h-dvh w-full max-w-5xl flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
      <header className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-medium">
            {exerciseTitle(config)} <span className="text-sub">· {exerciseSubtitle(config)}</span>
          </h1>
        </div>
        <span className="tabular font-mono text-sm text-sub">{hud.progressText}</span>
        <button
          type="button"
          onClick={togglePause}
          disabled={phase !== 'running' && phase !== 'paused'}
          aria-label={phase === 'paused' ? 'Continuar' : 'Pausar'}
          title="Pausar (espaço)"
          className="grid size-10 place-items-center rounded-lg text-lg text-sub hover:bg-surface hover:text-text disabled:opacity-30"
        >
          {phase === 'paused' ? <IconPlay /> : <IconPause />}
        </button>
        <button
          type="button"
          onClick={exit}
          aria-label="Sair"
          title="Sair"
          className="grid size-10 place-items-center rounded-lg text-lg text-sub hover:bg-surface hover:text-text"
        >
          <IconX />
        </button>
      </header>
      <ProgressBar value={hud.progress} className="mt-3" />

      <div className="mt-4 flex min-h-6 flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-sub">
        {hud.stats.map((s) => (
          <span key={s.label}>
            {s.label} <span className="tabular font-mono text-text">{s.value}</span>
          </span>
        ))}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col justify-center">
        {hud.toast && (
          <div className="absolute top-2 left-1/2 z-10 -translate-x-1/2 animate-fade-in rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink">
            {hud.toast}
          </div>
        )}
        <svg ref={svgRef} className="h-[clamp(150px,36dvh,360px)] w-full shrink-0" aria-label="Pauta" role="img" />
        {hud.countdown && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span key={hud.countdown} className="animate-pop font-mono text-7xl font-semibold text-accent/80">
              {hud.countdown}
            </span>
          </div>
        )}
        <div className="flex min-h-16 flex-col items-center justify-start gap-0.5 text-center" aria-live="polite">
          {fb && fb.kind !== 'ok' && (
            <div key={fb.key} className="animate-fade-in">
              <div
                className={cx(
                  'text-2xl font-semibold',
                  fb.kind === 'err' && 'text-err',
                  fb.kind === 'oct' && 'text-oct',
                  fb.kind === 'info' && 'text-sub',
                )}
              >
                {fb.text}
              </div>
              {fb.detail && <div className="text-sm text-sub">{fb.detail}</div>}
            </div>
          )}
          {fb && fb.kind === 'ok' && fb.text && (
            <div key={fb.key} className="animate-fade-in">
              <div className="text-2xl font-semibold text-ok">{fb.text}</div>
              {fb.detail && <div className="text-sm text-sub">{fb.detail}</div>}
            </div>
          )}
        </div>
        {hud.reps && (
          <div className="flex justify-center gap-2" aria-label={`${hud.reps.done} de ${hud.reps.total} toques`}>
            {Array.from({ length: hud.reps.total }, (_, i) => (
              <span
                key={i}
                className={cx('size-2.5 rounded-full transition-colors duration-150', i < hud.reps!.done ? 'bg-ok' : 'bg-surface-2')}
              />
            ))}
          </div>
        )}
        {hud.fret && (
          <div className="mx-auto mt-2 w-full max-w-sm animate-fade-in">
            <Fretboard
              toFret={Math.max(5, hud.fret.target.fret, hud.fret.played?.fret ?? 0)}
              ariaLabel={`Nota certa ${hud.fret.targetName}; tocada ${hud.fret.playedName ?? ''}`}
              markers={[
                ...(hud.fret.played ? [{ position: hud.fret.played, kind: 'played' as const }] : []),
                { position: hud.fret.target, kind: 'target' as const },
              ]}
            />
            <div className="mt-1 flex justify-center gap-4 text-xs text-sub">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-ok" /> {hud.fret.targetName}
              </span>
              {hud.fret.playedName && (
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-err" /> tocada {hud.fret.playedName}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="mt-4 flex flex-col items-center gap-3">
        {input === 'buttons' ? (
          <NoteButtons
            accidentals={frozen.accidentals}
            disabled={phase !== 'running'}
            onAnswer={(s, t) => ctrl.current?.answerButton(s, t) ?? null}
          />
        ) : (
          mic && <MicMeter mic={mic} />
        )}
        <div className="hidden items-center gap-3 text-xs text-sub sm:flex">
          <span className="flex items-center gap-1.5"><Kbd>espaço</Kbd> pausar</span>
          <span className="flex items-center gap-1.5"><Kbd>esc</Kbd> sair</span>
        </div>
      </footer>

      {(phase === 'paused' || phase === 'needs-gesture' || phase === 'mic-error') && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-bg/85 p-6 backdrop-blur-sm animate-fade-in">
          <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
            {phase === 'paused' && (
              <>
                <h2 className="text-2xl font-semibold">pausado</h2>
                <Button variant="primary" className="w-full" onClick={togglePause} autoFocus>
                  <IconPlay /> continuar
                </Button>
                <div className="flex w-full gap-2">
                  <Button className="flex-1" onClick={restart}>
                    <IconRedo /> reiniciar
                  </Button>
                  <Button className="flex-1" onClick={exit}>
                    <IconX /> sair
                  </Button>
                </div>
              </>
            )}
            {phase === 'needs-gesture' && (
              <>
                <h2 className="text-2xl font-semibold">pronto?</h2>
                <p className="text-sm text-sub">O navegador precisa de um clique para liberar o áudio.</p>
                <Button variant="primary" className="w-full" onClick={beginAfterGesture} autoFocus>
                  <IconPlay /> começar
                </Button>
              </>
            )}
            {phase === 'mic-error' && (
              <>
                <h2 className="text-2xl font-semibold">sem microfone</h2>
                <p className="text-sm text-sub">
                  Não foi possível abrir o microfone. Verifique a permissão do navegador e o dispositivo escolhido nas
                  configurações.
                </p>
                <p className="w-full rounded-md bg-surface px-3 py-2 text-left font-mono text-xs break-words text-sub">{micError}</p>
                <div className="flex w-full gap-2">
                  <Button className="flex-1" onClick={restart}>
                    <IconRedo /> tentar de novo
                  </Button>
                  <Button className="flex-1" onClick={() => navigate({ name: 'settings' })}>
                    configurações
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
