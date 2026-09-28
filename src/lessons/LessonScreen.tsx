import { useCallback, useEffect, useRef, useState } from 'react'
import { navigate } from '../app/router'
import { ensureAudioRunning, isAudioRunning } from '../audio/clock'
import { Microphone } from '../audio/microphone'
import { LESSON } from '../config'
import { loadSettings, saveLessonResult, type Settings } from '../db/db'
import { EMPTY_HUD, type Hud } from '../exercises/controller'
import { startActivity, startLesson, startPractice } from '../exercises/start'
import { activity, TOPIC_TITLE, type Timbre } from '../exercises/types'
import { Button, cx, ProgressBar } from '../ui/controls'
import { IconArrowRight, IconBook, IconHelp, IconPlay, IconRedo, IconX } from '../ui/icons'
import { ConceptCards } from './ConceptCards'
import { guideOf } from './guides'
import { lesson, nextLesson, unitOf } from './curriculum'
import { accuracyOf, challengeTime, passes, seconds, type LessonResult, type Practice, type Segment } from './lessons'
import { NotesSegment } from './NotesSegment'
import { RhythmSegment } from './RhythmSegment'
import { ScoreSegment } from './ScoreSegment'
import type { SegmentHandle, SegmentProps } from './segments'

type Phase = 'loading' | 'needs-gesture' | 'mic-error' | 'cards' | 'running' | 'between' | 'done'

/** Cartão antes de um segmento que não é o primeiro (ex.: "no tempo" do violão). */
function betweenCard(s: Segment): { title: string; detail?: string } {
  if (s.kind === 'score' && s.content === 'repeat') return { title: 'No tempo', detail: 'toque cada nota junto com o metrônomo, uma por pulso' }
  if (s.kind === 'score') return { title: 'No tempo', detail: 'leia e responda junto com o metrônomo' }
  if (s.kind === 'rhythm') return { title: 'Ritmo' }
  return { title: 'Agora as notas' }
}

function combine(list: LessonResult[]): LessonResult {
  const times = list.map((r) => r.meanTime).filter((t): t is number => t !== undefined)
  return {
    correct: list.reduce((s, r) => s + r.correct, 0),
    attempts: list.reduce((s, r) => s + r.attempts, 0),
    meanTime: times.length ? times.reduce((a, b) => a + b, 0) / times.length : undefined,
  }
}

/** O que falta para marcar como feita (ou que já está). */
function status(challenge: boolean | undefined, limit: number | null, r: LessonResult, passed: boolean): string {
  if (passed) return challenge ? 'unidade feita' : 'lição feita'
  if (accuracyOf(r) < LESSON.pass) return `${Math.round(LESSON.pass * 100)}% para marcar como feita`
  return `até ${seconds(limit ?? LESSON.challengeTime)} por nota para marcar como feita`
}

/**
 * Uma lição de trilha: cartões de conceito, depois os segmentos em ordem
 * (notas, ritmo ou partitura no tempo), com um cartão entre eles. O "?"
 * reabre os conceitos. No fim, o acerto e a próxima lição.
 */
export function LessonScreen({ lessonId }: { lessonId: string }) {
  const def = lesson(lessonId)
  const unit = unitOf(lessonId)
  const number = unit.lessons.indexOf(def) + 1
  const next = nextLesson(lessonId)
  const [phase, setPhase] = useState<Phase>('loading')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [mic, setMic] = useState<Microphone | null>(null)
  const [micError, setMicError] = useState('')
  const [seg, setSeg] = useState(0)
  const [help, setHelp] = useState(false)
  const [result, setResult] = useState<LessonResult | null>(null)
  const [hud, setHudState] = useState<Hud>(EMPTY_HUD)
  const setHud = useCallback((patch: Partial<Hud>) => setHudState((h) => ({ ...h, ...patch })), [])
  const results = useRef<LessonResult[]>([])
  const handle = useRef<SegmentHandle | null>(null)
  const needsMic = def.segments.some((s) => s.kind !== 'rhythm' && s.input === 'mic')
  const hasCards = !!def.cards?.length
  const segment = def.segments[seg]

  // ajustes e microfone; depois, o áudio e os cartões
  useEffect(() => {
    let cancelled = false
    let opened: Microphone | null = null
    void (async () => {
      const s = await loadSettings()
      if (cancelled) return
      setSettings(s)
      if (needsMic) {
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
      }
      if (isAudioRunning() || (await ensureAudioRunning())) {
        if (!cancelled) setPhase(hasCards ? 'cards' : 'running')
      } else if (!cancelled) setPhase('needs-gesture')
    })()
    return () => {
      cancelled = true
      opened?.close()
    }
  }, [needsMic, hasCards])

  const beginAfterGesture = async () => {
    if (await ensureAudioRunning()) setPhase(hasCards ? 'cards' : 'running')
  }

  const finishSegment = useCallback(
    (r: LessonResult) => {
      results.current.push(r)
      if (seg + 1 < def.segments.length) {
        setHudState((h) => ({ ...h, feedback: null, countdown: null }))
        setSeg(seg + 1)
        setPhase('between')
        return
      }
      const total = combine(results.current)
      const accuracy = accuracyOf(total)
      const passed = passes(def, total)
      // o recorde de tempo só vale com o acerto mínimo
      void saveLessonResult(def.id, accuracy, passed, accuracy >= LESSON.pass ? total.meanTime : undefined).then(() => {
        setResult(total)
        setPhase('done')
      })
    },
    [seg, def],
  )

  const leave = () => navigate({ name: 'topic', topic: unit.topic }, true)
  const again = () => startLesson(lessonId, true)
  // depois da última lição, a trilha desemboca na prática livre
  const goNext = () => (next ? startLesson(next.id, true) : startActivity(unit.topic === 'teoria' ? 'reading' : 'notes', true))
  const passed = result ? passes(def, result) : false
  const guide = guideOf(unit.id)
  const openGuide = () => navigate({ name: 'guide', unit: unit.id })
  // Desafio que falhou só pelo tempo: o próximo passo é treinar, não repetir
  const slow = !!def.challenge && !!result && !passed && accuracyOf(result) >= LESSON.pass
  const practice = def.challenge ? unit.practice : undefined
  const canMore = !!handle.current?.more
  const trainMore = () => {
    // o "+" soma ao resultado do último segmento, que continua na mesma tela
    results.current.pop()
    setResult(null)
    setPhase('running')
    handle.current?.more?.(LESSON.moreNotes)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (help || phase === 'cards') return
      if (e.key === 'Escape') {
        e.preventDefault()
        leave()
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement) && phase !== 'between') {
        if (phase === 'needs-gesture') void beginAfterGesture()
        else if (phase === 'done') slow && practice ? startPractice(practice, true) : (passed ? goNext : again)()
      } else if (phase === 'between' && !e.repeat && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        e.stopImmediatePropagation()
        setPhase('running')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const stat = hud.stats[0]
  const progress = (seg + (hud.progress ?? 0)) / def.segments.length
  const nextLabel = `próxima: ${next ? (next.unit === def.unit ? next.title : `${unitOf(next.id).title} · ${next.title}`) : unit.topic === 'teoria' ? 'Leitura' : 'Notas'}`
  const limit = challengeTime(def)
  // o segmento só monta depois dos cartões (e continua montado no resultado, para o "+")
  const mounted = phase === 'running' || phase === 'done'
  const props: Omit<SegmentProps<never>, 'body'> | null = settings && {
    lesson: def,
    settings,
    mic,
    timbre: (settings.activities.reading?.timbre ?? 'piano') as Timbre,
    paused: help || phase === 'done',
    hud,
    setHud,
    onDone: finishSegment,
    handle,
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-5xl flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
      <header className="flex items-center gap-3">
        <span className="flex-1 truncate text-sm text-sub">
          {unit.title} {number} · <span className="text-text">{def.title}</span>
        </span>
        {stat && (
          <span className="tabular font-mono text-sm text-sub" title={stat.label}>
            <span className="text-text">{stat.value}</span>
          </span>
        )}
        {hud.progressText && <span className="tabular font-mono text-sm text-sub">{hud.progressText}</span>}
        {hasCards && (
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
        <button type="button" onClick={again} aria-label="Reiniciar" title="Reiniciar" className="grid size-10 place-items-center rounded-lg text-lg text-sub hover:bg-surface hover:text-text">
          <IconRedo />
        </button>
        <button type="button" onClick={leave} aria-label="Sair" title="Sair (esc)" className="grid size-10 place-items-center rounded-lg text-lg text-sub hover:bg-surface hover:text-text">
          <IconX />
        </button>
      </header>
      <ProgressBar value={progress} className="mt-3" />

      {props && mounted && segment ? <SegmentView key={seg} segment={segment} {...props} /> : <div className="flex-1" />}

      {phase === 'between' && segment && (
        <button type="button" onClick={() => setPhase('running')} className="fixed inset-0 z-20 grid animate-fade-in place-items-center bg-bg/85 p-6 backdrop-blur-sm">
          <span className="flex flex-col items-center gap-1">
            <span className="text-3xl font-semibold tracking-tight">{betweenCard(segment).title}</span>
            {betweenCard(segment).detail && <span className="text-sub">{betweenCard(segment).detail}</span>}
            <span className="mt-3 text-xs text-sub">qualquer tecla para seguir</span>
          </span>
        </button>
      )}

      {(phase === 'cards' || help) && def.cards && (
        <ConceptCards
          ids={def.cards}
          onGuide={guide ? openGuide : undefined}
          onClose={() => {
            if (help) setHelp(false)
            else setPhase('running')
          }}
        />
      )}

      {(phase === 'needs-gesture' || phase === 'mic-error' || (phase === 'done' && result)) && (
        <div className="fixed inset-0 z-20 grid animate-fade-in place-items-center bg-bg/85 p-6 backdrop-blur-sm">
          <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
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
                <p className="text-sm text-sub">Esta lição ouve o violão. Verifique a permissão do navegador e o dispositivo nas configurações.</p>
                <p className="w-full rounded-md bg-surface px-3 py-2 text-left font-mono text-xs break-words text-sub">{micError}</p>
                <div className="flex w-full gap-2">
                  <Button className="flex-1" onClick={again}>
                    <IconRedo /> tentar de novo
                  </Button>
                  <Button className="flex-1" onClick={() => navigate({ name: 'settings' })}>
                    configurações
                  </Button>
                </div>
              </>
            )}
            {phase === 'done' && result && (
              <>
                <div className="flex flex-col items-center gap-1">
                  <span className={cx('tabular font-mono text-5xl font-semibold', passed ? 'text-ok' : 'text-text')}>{Math.round(accuracyOf(result) * 100)}%</span>
                  {limit !== null && result.meanTime !== undefined && <span className="tabular font-mono text-sm text-text">{seconds(result.meanTime)} por nota</span>}
                  <span className="text-sm text-sub">{status(def.challenge, limit, result, passed)}</span>
                </div>
                {slow && practice ? (
                  <>
                    <p className="text-base text-text">{practiceText('slow')}</p>
                    <Button variant="primary" className="w-full" onClick={() => startPractice(practice, true)} autoFocus>
                      treinar em {practiceName(practice)} <IconArrowRight />
                    </Button>
                  </>
                ) : (
                  <Button variant="primary" className="w-full" onClick={passed ? goNext : again} autoFocus>
                    {passed ? (
                      <>
                        {nextLabel} <IconArrowRight />
                      </>
                    ) : (
                      <>
                        <IconRedo /> de novo
                      </>
                    )}
                  </Button>
                )}
                {practice && !slow && (
                  <div className="flex w-full flex-col items-center gap-3 rounded-xl border border-line p-4">
                    <p className="text-base text-text">{practiceText(passed ? 'passed' : 'missed')}</p>
                    <Button className="w-full" onClick={() => startPractice(practice, true)}>
                      treinar em {practiceName(practice)} <IconArrowRight />
                    </Button>
                    {!passed && guide && (
                      <button type="button" onClick={openGuide} className="flex items-center gap-1.5 text-sm text-sub hover:text-text">
                        <IconBook /> ou reler a teoria no guia
                      </button>
                    )}
                  </div>
                )}
                <div className="flex w-full gap-2">
                  {canMore && !def.challenge && (
                    <Button className="flex-1" onClick={trainMore}>
                      + {LESSON.moreNotes}
                    </Button>
                  )}
                  {passed || slow ? (
                    <Button className="flex-1" onClick={again}>
                      <IconRedo /> de novo
                    </Button>
                  ) : null}
                  {!passed && (
                    <Button className="flex-1" onClick={goNext} title={nextLabel}>
                      próxima <IconArrowRight />
                    </Button>
                  )}
                  <Button className="flex-1" onClick={leave}>
                    <IconX /> sair
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

/** "Praticar › Leitura" */
function practiceName(p: Practice): string {
  const a = activity(p.activity)
  return `${TOPIC_TITLE[a.topic]} › ${a.title}`
}

/**
 * Depois do Desafio: onde continuar treinando o que a unidade ensinou. Uma
 * vez não fixa; a prática livre fica fora da trilha e o aluno precisa saber.
 */
function practiceText(outcome: 'passed' | 'missed' | 'slow'): string {
  if (outcome === 'slow') return 'Você acertou o bastante, mas passou do tempo. A leitura fica rápida com repetição: treine um pouco todo dia na prática livre.'
  if (outcome === 'missed') return 'Treine sem pressa na prática livre e volte ao Desafio quando quiser.'
  return 'Para não esquecer, volte a treinar de vez em quando na prática livre.'
}

function SegmentView({ segment, ...props }: { segment: Segment } & Omit<SegmentProps<never>, 'body'>) {
  if (segment.kind === 'notes') return <NotesSegment body={segment} {...props} />
  if (segment.kind === 'rhythm') return <RhythmSegment body={segment} {...props} />
  return <ScoreSegment body={segment} {...props} />
}
