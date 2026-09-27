import { useEffect, useRef, useState } from 'react'
import { navigate } from '../app/router'
import { ensureAudioRunning } from '../audio/clock'
import { Microphone, micSupported } from '../audio/microphone'
import { playNote } from '../audio/synth'
import { loadSettings, saveActivityOptions } from '../db/db'
import { midiAt, positionLabel, positionsOf, samePosition, type Position } from '../domain/fretboard'
import { namePt, namePtOctave, spellingsOf, writtenFromSounding, type Note } from '../domain/notes'
import { displayPosition, type ScaleId } from '../domain/scales'
import { MicMeter } from '../exercises/MicMeter'
import { Fretboard } from '../staff/Fretboard'
import { StaffSvg } from '../staff/StaffSvg'
import { Segmented } from '../ui/controls'
import { IconX } from '../ui/icons'

const TO_FRET = 12

/**
 * Explorar: clique numa casa (ou toque no violão) e veja a nota na pauta.
 * Sem placar. O ajuste ♯/♭ escolhe a grafia das casas com acidente.
 */
export function Explore() {
  const [pos, setPos] = useState<Position | null>(null)
  const [flats, setFlats] = useState(false)
  const [scale, setScale] = useState<ScaleId>('solta')
  const [mic, setMic] = useState<Microphone | null>(null)
  const scaleRef = useRef(scale)
  scaleRef.current = scale

  useEffect(() => {
    let cancelled = false
    let opened: Microphone | null = null
    void (async () => {
      const s = await loadSettings()
      if (cancelled) return
      setFlats(!!s.activities.explore?.accidentals)
      setScale(s.scale)
      if (!micSupported()) return
      try {
        opened = await Microphone.open(s.audioDeviceId, s.latencyMs)
        if (cancelled) return opened.close()
        setMic(opened)
      } catch {
        /* sem microfone: só o clique */
      }
    })()
    return () => {
      cancelled = true
      opened?.close()
    }
  }, [])

  // o que o violão toca aparece no braço
  useEffect(() => {
    if (!mic) return
    let id = 0
    const tick = () => {
      id = requestAnimationFrame(tick)
      for (const e of mic.poll()) {
        if (e.type !== 'note') continue
        const p = displayPosition(scaleRef.current, e.midi, true) ?? positionsOf(e.midi, TO_FRET)[0]
        if (p) setPos(p)
      }
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [mic])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && navigate({ name: 'topic', topic: 'violao' })
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pick = (p: Position) => {
    setPos(p)
    void ensureAudioRunning().then(() => playNote(midiAt(p), 'guitar'))
  }

  const midi = pos ? midiAt(pos) : null
  const spellings = midi !== null ? spellingsOf(midi) : []
  const sounding: Note | null = spellings.length ? (flats && spellings[1] ? spellings[1] : spellings[0]) : null
  const written = sounding ? writtenFromSounding(sounding) : null
  const others = midi !== null ? positionsOf(midi, TO_FRET).filter((p) => !pos || !samePosition(p, pos)) : []

  return (
    <div className="mx-auto flex h-dvh w-full max-w-5xl flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
      <header className="flex items-center gap-3">
        <span className="flex-1 truncate text-sm text-sub">Explorar</span>
        <button
          type="button"
          onClick={() => navigate({ name: 'topic', topic: 'violao' })}
          aria-label="Sair"
          title="Sair (esc)"
          className="grid size-10 place-items-center rounded-lg text-lg text-sub hover:bg-surface hover:text-text"
        >
          <IconX />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
        <div className="flex w-full max-w-xl items-center justify-center gap-8">
          <StaffSvg
            className="h-56 shrink-0 sm:h-72"
            minWidth={120}
            ariaLabel={written ? `Nota ${namePtOctave(written)}` : 'Pauta vazia'}
            notes={written ? [{ key: `${written.letter}${written.acc}${written.octave}`, note: written, draw: { figure: 'whole' } }] : []}
          />
          <div className="flex w-36 flex-col">
            {written && sounding && pos ? (
              <>
                <span className="text-5xl font-semibold">{namePt(written)}</span>
                <span className="text-sm text-sub">{namePtOctave(written)} na pauta</span>
                <span className="mt-2 text-sm text-sub">
                  {pos.string}ª corda, {pos.fret === 0 ? 'solta' : `casa ${pos.fret}`}
                </span>
              </>
            ) : (
              <span className="text-sm text-sub">clique numa casa{mic ? ' ou toque' : ''}</span>
            )}
          </div>
        </div>
        {others.length > 0 && (
          <span className="text-xs text-sub">
            mesma nota também em: {others.map(positionLabel).join(' · ')}
          </span>
        )}
      </div>

      <footer className="flex flex-col gap-3">
        <div className="overflow-x-auto">
          <Fretboard
            className="mx-auto w-full min-w-[40rem]"
            toFret={TO_FRET}
            onPick={pick}
            ariaLabel="Braço do violão: clique numa casa"
            markers={[
              ...others.map((p) => ({ position: p, kind: 'same' as const })),
              ...(pos && written ? [{ position: pos, kind: 'pick' as const, label: namePt(written) }] : []),
            ]}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">{mic && <MicMeter mic={mic} />}</div>
          <Segmented<string>
            size="sm"
            label="Grafia dos acidentes"
            value={flats ? 'b' : '#'}
            onChange={(v) => {
              setFlats(v === 'b')
              void saveActivityOptions('explore', { accidentals: v === 'b' })
            }}
            options={[
              { value: '#', label: '♯' },
              { value: 'b', label: '♭' },
            ]}
          />
        </div>
      </footer>
    </div>
  )
}
