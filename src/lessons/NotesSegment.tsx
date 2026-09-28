import { useEffect, useRef, useState } from 'react'
import { parseNote } from '../domain/notes'
import type { FretFeedback } from '../exercises/controller'
import { MicMeter } from '../exercises/MicMeter'
import { NoteButtons } from '../exercises/NoteButtons'
import { ExerciseBody, FeedbackLine, FretHint, PartCard, TipLine } from '../exercises/parts'
import { StaffStage } from '../exercises/stage'
import { CLEF_END } from '../staff/geometry'
import { cx, Kbd } from '../ui/controls'
import { IconStaffMap } from '../ui/icons'
import { LessonController } from './controller'
import { reviewFor } from './curriculum'
import { lessonNotes, type LessonCard, type NotesBody } from './lessons'
import type { SegmentProps } from './segments'

/** Cola entre a clave e a nota: linhas numa coluna, espaços na outra. */
const GUIDE_X = { line: CLEF_END + 12, space: CLEF_END + 28 }
/** as notas somem antes da cola (a partir daqui aparecem) */
const FADE_FROM = CLEF_END + 36
const HIT_X = CLEF_END + 70

/** Notas na pauta, uma de cada vez: pelos botões ou pelo violão. */
export function NotesSegment({ lesson, body, mic, timbre, paused, hud, setHud, onDone, handle }: SegmentProps<NotesBody>) {
  const svgRef = useRef<SVGSVGElement>(null)
  const ctrl = useRef<LessonController | null>(null)
  const timbreRef = useRef(timbre)
  timbreRef.current = timbre
  const [card, setCard] = useState<LessonCard | null>(null)
  const [fret, setFret] = useState<FretFeedback | null>(null)
  const [tip, setTip] = useState<string | null>(null)
  const useMic = body.input === 'mic'

  useEffect(() => {
    const stage = new StaffStage(svgRef.current!, { hitX: HIT_X, fadeFrom: FADE_FROM })
    const review = reviewFor(lesson, body)
    const guide = stage.addGuide(lessonNotes(body), GUIDE_X, review.map(parseNote))
    const c = new LessonController({
      lesson: { body, challenge: lesson.challenge, review },
      stage,
      guide,
      timbre: () => timbreRef.current,
      setHud,
      setCard,
      finish: onDone,
      mic: useMic ? mic : null,
      setFret: useMic ? setFret : undefined,
      setTip: useMic ? undefined : setTip,
    })
    ctrl.current = c
    handle.current = { more: (n) => c.more(n), answered: () => c.answered }
    if (import.meta.env.DEV) (window as unknown as { __lambada: unknown }).__lambada = { controller: c }
    c.start()
    return () => {
      c.dispose()
      stage.dispose()
      ctrl.current = null
    }
    // um controlador por segmento montado
  }, [])

  useEffect(() => {
    if (paused) ctrl.current?.pause()
    else ctrl.current?.resume()
  }, [paused])

  // H: ver a cola na nota da vez
  const canHelp = !lesson.challenge && !body.noGuide
  useEffect(() => {
    if (!canHelp) return
    const onKey = (e: KeyboardEvent) => {
      if (paused || card || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 'h') return
      e.preventDefault()
      ctrl.current?.help()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canHelp, card, paused])

  // qualquer tecla fecha o cartão entre as partes (as de nota já fecham pelos botões)
  useEffect(() => {
    if (!card) return
    const onKey = (e: KeyboardEvent) => {
      if (paused || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.key === 'Escape' || e.key === 'Tab') return
      if (e.key === 'Enter' || e.key === ' ') e.preventDefault()
      ctrl.current?.dismissCard()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [card, paused])

  return (
    <ExerciseBody
      footer={
        useMic ? (
          mic && <MicMeter mic={mic} />
        ) : (
          <NoteButtons accidentals={!!body.accidentals} disabled={paused} onAnswer={(s, t) => ctrl.current?.answerButton(s, t) ?? null} />
        )
      }
    >
      <svg
        ref={svgRef}
        // 'staff' também aqui: o React reescreve a classe e não pode apagar a do palco
        className={cx('staff w-full shrink-0 transition-[height] duration-200', fret ? 'h-[clamp(120px,26dvh,300px)]' : 'h-[clamp(150px,36dvh,360px)]')}
        aria-label="Pauta"
        role="img"
      />
      <FeedbackLine fb={hud.feedback} />
      {tip && <TipLine text={tip} />}
      {canHelp && (
        <button
          type="button"
          onClick={() => ctrl.current?.help()}
          disabled={paused}
          title={
            useMic
              ? 'Mostra onde fica no braço e os nomes das linhas e espaços nesta nota (ela não conta e volta depois)'
              : 'Mostra os nomes das linhas e espaços nesta nota (ela não conta e volta depois)'
          }
          className="mx-auto flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-sub hover:bg-surface hover:text-text"
        >
          <IconStaffMap /> ver a cola <Kbd>H</Kbd>
        </button>
      )}
      {fret && <FretHint fret={fret} />}
      {card && (
        <PartCard
          title={card.title}
          detail={card.detail}
          hint={useMic ? 'toque uma nota ou aperte uma tecla para seguir' : undefined}
          onClick={() => ctrl.current?.dismissCard()}
        />
      )}
    </ExerciseBody>
  )
}
