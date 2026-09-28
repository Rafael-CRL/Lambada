import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { navigate } from '../app/router'
import { ensureAudioRunning, isAudioRunning } from '../audio/clock'
import { Microphone } from '../audio/microphone'
import { db, loadSettings, recordId, saveActivityOptions, saveSettings, type SessionRecord, type Settings } from '../db/db'
import { StudySession } from '../engine/session'
import { Button, cx, ProgressBar } from '../ui/controls'
import { IconHelp, IconPause, IconPlay, IconRedo, IconX } from '../ui/icons'
import { ConceptCards } from '../lessons/ConceptCards'
import { useFirstCards } from '../lessons/useFirstCards'
import { ControlsDock, type OptionChange } from './ControlsDock'
import { EMPTY_HUD, type Hud } from './controller'
import { MicMeter } from './MicMeter'
import { Countdown, FeedbackLine, FretHint } from './parts'
import { NoteButtons } from './NoteButtons'
import { ScoreController } from './score'
import { NOTE_SETS, writtenRange } from '../domain/scales'
import { parseNote } from '../domain/notes'
import { staffStep } from '../domain/staff'
import { NoteMap, type MapReach } from '../staff/NoteMap'
import { StaffStage } from './stage'
import { onceOptions, restartActivity } from './start'
import { activity, buildConfig, type ActivityId, type ExerciseConfig } from './types'

type Phase = 'loading' | 'needs-gesture' | 'mic-error' | 'running' | 'paused'

/** Abaixo disso, sair não mostra resumo (volta para a lista). */
const MIN_FOR_SUMMARY = 10

async function saveResult(session: StudySession, completed: boolean, extra?: Partial<SessionRecord>): Promise<SessionRecord | null> {
  const rec = await session.finish(completed, extra)
  if (rec && rec.score !== undefined && rec.bpm !== undefined) {
    const id = recordId(rec.input, rec.bpm, rec.rhythmLevel)
    const prev = await db.records.get(id)
    if (!prev || rec.score > prev.score) {
      await db.records.put({ id, input: rec.input, bpm: rec.bpm, score: rec.score, at: rec.endedAt })
    }
  }
  return rec
}

/** Ajustes que mudam a partitura: reiniciam a sessão. Os demais valem na hora. */
const RESTARTS: (keyof OptionChange)[] = ['tempo', 'level', 'duration', 'scale', 'notes']

function pickOptions(c: ExerciseConfig) {
  return { tempo: c.tempo, bpm: c.bpm, level: c.level, duration: c.duration, timbre: c.timbre, accidentals: c.accidentals, notes: c.notes ?? 'todas' }
}

export function ExerciseScreen({ activityId }: { activityId: ActivityId }) {
  const def = activity(activityId)
  const input = def.input
  const svgRef = useRef<SVGSVGElement>(null)
  const ctrl = useRef<ScoreController | null>(null)
  const sessionRef = useRef<StudySession | null>(null)
  /** objeto vivo lido pelo controlador (som, BPM e ♯♭ mudam sem reiniciar) */
  const configRef = useRef<ExerciseConfig | null>(null)
  const [config, setConfig] = useState<ExerciseConfig | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [generation, setGeneration] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const [mic, setMic] = useState<Microphone | null>(null)
  const [micError, setMicError] = useState('')
  const [hud, setHudState] = useState<Hud>(EMPTY_HUD)
  const setHud = useCallback((patch: Partial<Hud>) => setHudState((h) => ({ ...h, ...patch })), [])
  const [dockOpen, setDockOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [mapReach, setMapReach] = useState<MapReach>(12)
  const toggleMap = useCallback(() => setMapOpen((v) => !v), [])
  const scale = config?.scale ?? 'solta'
  // região praticada: o conjunto de notas da Leitura, ou a região do violão (o resto fica apagado na cola)
  const noteSet = config?.notes
  const region = useMemo<[number, number]>(() => {
    if (noteSet) {
      const steps = NOTE_SETS[noteSet].map((id) => staffStep(parseNote(id)))
      return [Math.min(...steps), Math.max(...steps)]
    }
    const [lo, hi] = writtenRange(scale)
    return [staffStep(lo), staffStep(hi)]
  }, [scale, noteSet])
  const leaving = useRef(false)
  // cartões de conceito (Escala): sozinhos na primeira vez, depois pelo "?"
  const [help, setHelp] = useFirstCards(activityId, def.cards)
  const pausedByHelp = useRef(false)
  useEffect(() => {
    const c = ctrl.current
    if (help && c && !c.paused) {
      c.pause()
      pausedByHelp.current = true
    } else if (!help && pausedByHelp.current) {
      pausedByHelp.current = false
      c?.resume()
    }
  }, [help, phase])

  // ajustes salvos e microfone: uma vez por tela
  useEffect(() => {
    let cancelled = false
    let opened: Microphone | null = null
    void (async () => {
      const s = await loadSettings()
      if (cancelled) return
      const c = buildConfig(activityId, { ...s.activities[activityId], ...onceOptions(activityId) }, s.scale)
      configRef.current = c
      setConfig(c)
      setSettings(s)
      if (input !== 'mic') return
      try {
        opened = await Microphone.open(s.audioDeviceId, s.latencyMs)
      } catch (e) {
        if (cancelled) return
        setMicError(e instanceof Error ? `${e.name}: ${e.message}` : String(e))
        setPhase('mic-error')
        return
      }
      if (cancelled) return opened.close()
      setMic(opened)
    })()
    return () => {
      cancelled = true
      opened?.close()
    }
  }, [activityId, input])

  // uma sessão por geração: ajustes que mudam a partitura criam outra
  const ready = settings !== null && (input !== 'mic' || mic !== null)
  useEffect(() => {
    if (!ready || !configRef.current || !settings) return
    let cancelled = false
    let stage: StaffStage | null = null
    let controller: ScoreController | null = null
    let session: StudySession | null = null
    let done = false
    setHudState(EMPTY_HUD)

    void (async () => {
      const c = configRef.current!
      session = await StudySession.open(c, c.scale, c.accidentals)
      if (cancelled) return
      sessionRef.current = session
      stage = new StaffStage(svgRef.current!, { hitX: 90 })
      controller = new ScoreController({
        config: c,
        settings,
        session,
        mic,
        stage,
        setHud,
        finish: (extra) => {
          done = true
          void saveResult(session!, true, extra).then((rec) => {
            if (rec?.id !== undefined) navigate({ name: 'summary', id: rec.id }, true)
            else navigate({ name: 'topic', topic: def.topic }, true)
          })
        },
      })
      ctrl.current = controller
      if (import.meta.env.DEV) (window as unknown as { __lambada: unknown }).__lambada = { controller, session }
      if (isAudioRunning() || (await ensureAudioRunning())) {
        if (cancelled) return
        controller.start()
        setPhase('running')
      } else if (!cancelled) setPhase('needs-gesture')
    })()

    return () => {
      cancelled = true
      controller?.dispose()
      stage?.dispose()
      ctrl.current = null
      // reinício (ou saída por outro caminho): guarda o que foi feito
      if (session && !done && !leaving.current) void saveResult(session, false)
    }
  }, [ready, generation, settings, mic, setHud, def.topic])

  const change = (c: OptionChange) => {
    const cur = configRef.current
    if (!cur) return
    const { scale, ...opts } = c
    if (scale) void saveSettings({ scale })
    if (Object.keys(opts).length) void saveActivityOptions(activityId, opts)
    const next = buildConfig(activityId, { ...pickOptions(cur), ...opts }, scale ?? cur.scale)
    if (RESTARTS.some((k) => c[k] !== undefined)) {
      configRef.current = next
      setConfig(next)
      setGeneration((g) => g + 1)
      return
    }
    // valem na hora, no mesmo objeto que o controlador lê
    Object.assign(cur, { timbre: next.timbre, bpm: next.bpm, accidentals: next.accidentals })
    if (c.bpm !== undefined) ctrl.current?.setBpm(next.bpm)
    if (c.accidentals !== undefined) sessionRef.current?.setAccidentals(next.accidentals)
    setConfig({ ...cur })
  }

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

  /** Sair: com bastante coisa feita, mostra o resumo; senão volta para a lista. */
  const leave = async () => {
    if (leaving.current) return
    leaving.current = true
    const c = ctrl.current
    const session = sessionRef.current
    const answered = c?.answered ?? 0
    c?.dispose()
    const rec = session ? await saveResult(session, configRef.current?.duration === 'infinite') : null
    if (rec?.id !== undefined && answered >= MIN_FOR_SUMMARY) navigate({ name: 'summary', id: rec.id }, true)
    else navigate({ name: 'topic', topic: def.topic }, true)
  }

  const restart = () => restartActivity(activityId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dockOpen || help) return
      if (e.key === 'Escape') {
        e.preventDefault()
        if (phase === 'paused') void leave()
        else togglePause()
      } else if (e.key === ' ' && (phase === 'paused' || phase === 'running') && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        togglePause()
      } else if (e.key === 'r' && input === 'mic' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        restart()
      } else if (e.key === 'Enter' && phase === 'needs-gesture') {
        void beginAfterGesture()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const fb = hud.feedback
  const stat = hud.stats[0]
  return (
    <div className="mx-auto flex h-dvh w-full max-w-5xl flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
      <header className="flex items-center gap-3">
        <span className="flex-1 truncate text-sm text-sub">{def.title}</span>
        {stat && (
          <span className="tabular font-mono text-sm text-sub" title={stat.label}>
            <span className="text-text">{stat.value}</span>
            {stat.label === 'pontos' && ' pts'}
            {stat.label === 'acertos' && ' ✓'}
          </span>
        )}
        {hud.progressText && <span className="tabular font-mono text-sm text-sub">{hud.progressText}</span>}
        {def.cards && (
          <button
            type="button"
            onClick={() => setHelp(true)}
            aria-label="Rever a explicação"
            title="Rever a explicação"
            className="grid size-10 place-items-center rounded-lg text-lg text-sub hover:bg-surface hover:text-text"
          >
            <IconHelp />
          </button>
        )}
        <button
          type="button"
          onClick={restart}
          aria-label="Reiniciar"
          title={input === "mic" ? "Reiniciar (r)" : "Reiniciar"}
          className="grid size-10 place-items-center rounded-lg text-lg text-sub hover:bg-surface hover:text-text"
        >
          <IconRedo />
        </button>
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
          onClick={() => void leave()}
          aria-label="Sair"
          title="Sair (esc)"
          className="grid size-10 place-items-center rounded-lg text-lg text-sub hover:bg-surface hover:text-text"
        >
          <IconX />
        </button>
      </header>
      <ProgressBar value={hud.progress ?? 0} className={cx('mt-3', hud.progress === null && 'invisible')} />

      {/* tela grande: pauta e botões juntos no meio, perto do olho e do mouse; celular: botões no rodapé, perto do polegar */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto sm:justify-center-safe">
        <div className="relative flex flex-col justify-center-safe max-sm:flex-1">
          {hud.toast && (
            <div className="absolute top-2 left-1/2 z-10 -translate-x-1/2 animate-fade-in rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink">
              {hud.toast}
            </div>
          )}
          <svg
            ref={svgRef}
            className={cx(
              // 'staff' também aqui: o React reescreve a classe e não pode apagar a do palco
              'staff w-full shrink-0 transition-[height] duration-200',
              mapOpen || hud.fret ? 'h-[clamp(120px,26dvh,300px)]' : 'h-[clamp(150px,36dvh,360px)]',
            )}
            aria-label="Pauta"
            role="img"
          />
          <Countdown value={hud.countdown} />
          <FeedbackLine fb={fb} infoTone="sub" />
          {mapOpen && (
            <div className="mt-2 animate-fade-in">
              <NoteMap region={region} reach={mapReach} onReach={setMapReach} />
            </div>
          )}
          {hud.fret && <FretHint fret={hud.fret} />}
        </div>

        <footer className="mt-2 flex flex-col gap-3">
          {config && (
            <div className="flex justify-end">
              <ControlsDock
                controls={def.controls}
                config={config}
                onChange={change}
                onOpenChange={setDockOpen}
                mapOpen={mapOpen}
                onToggleMap={toggleMap}
              />
            </div>
          )}
          {input === 'buttons' ? (
            <NoteButtons
              accidentals={config?.accidentals ?? false}
              disabled={phase !== 'running'}
              onAnswer={(s, t) => ctrl.current?.answerButton(s, t) ?? null}
            />
          ) : (
            mic && <MicMeter mic={mic} />
          )}
        </footer>
      </div>

      {help && def.cards && <ConceptCards ids={def.cards} onClose={() => setHelp(false)} />}

      {(phase === 'paused' || phase === 'needs-gesture' || phase === 'mic-error') && (
        <div className="fixed inset-0 z-20 grid animate-fade-in place-items-center bg-bg/85 p-6 backdrop-blur-sm">
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
                  <Button className="flex-1" onClick={() => void leave()}>
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
                  Não foi possível abrir o microfone. Verifique a permissão do navegador e o dispositivo escolhido nas configurações.
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
