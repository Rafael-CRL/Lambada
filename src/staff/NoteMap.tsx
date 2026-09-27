import { useState } from 'react'
import { positionsOf } from '../domain/fretboard'
import { LETTERS, midiOf, namePt, parseNote, soundingFromWritten, type Note } from '../domain/notes'
import { staffStep, WRITTEN_MIN } from '../domain/staff'
import { StaffSvg } from './StaffSvg'

/** Mais aguda até a casa 12 (padrão) e até a casa 19 (expandido), na 1ª corda. */
const TOP = { 12: parseNote('E6'), 19: parseNote('B6') } as const

/** Naturais escritas do Mi3 (6ª corda solta) até a nota mais aguda da casa `upTo` da 1ª corda. */
export function guitarRangeNaturals(upTo: 12 | 19 = 12): Note[] {
  const top = TOP[upTo]
  const out: Note[] = []
  for (let octave = WRITTEN_MIN.octave; octave <= top.octave; octave++) {
    for (const letter of LETTERS) {
      const n: Note = { letter, acc: 0, octave }
      if (staffStep(n) >= staffStep(WRITTEN_MIN) && staffStep(n) <= staffStep(top)) out.push(n)
    }
  }
  return out
}

function whereTitle(n: Note, maxFret: number): string {
  const pos = positionsOf(midiOf(soundingFromWritten(n)), maxFret)
  const where = pos.map((p) => `${p.string}ª ${p.fret === 0 ? 'solta' : `c. ${p.fret}`}`).join(' · ')
  return `${namePt(n)}${n.octave} — ${where}`
}

/**
 * Cola: todas as linhas e espaços que o violão alcança, com o nome de cada
 * nota. Até a casa 12 por padrão; a seta expande até a casa 19. As notas fora
 * da região praticada ficam mais apagadas.
 */
export function NoteMap({ practiced }: { practiced: (n: Note) => boolean }) {
  const [upTo, setUpTo] = useState<12 | 19>(12)
  const notes = guitarRangeNaturals(upTo)
  return (
    <div className="flex items-stretch gap-1 rounded-xl bg-surface/70 py-1 pl-2">
      <div className="min-w-0 flex-1 overflow-x-auto">
        <StaffSvg
          className="h-auto w-full"
          style={{ minWidth: `${notes.length * 1.9 + 4}rem` }}
          spacing={30}
          topPad={upTo === 19 ? 26 : 0}
          ariaLabel={`Notas de cada linha e espaço até a casa ${upTo}`}
          notes={notes.map((n) => ({
            key: `${n.letter}${n.octave}`,
            note: n,
            draw: { figure: 'whole' as const },
            label: namePt(n),
            title: whereTitle(n, upTo),
            className: practiced(n) ? '' : 'is-muted',
          }))}
        />
      </div>
      <button
        type="button"
        onClick={() => setUpTo(upTo === 12 ? 19 : 12)}
        aria-label={upTo === 12 ? 'Mostrar até a casa 19' : 'Mostrar só até a casa 12'}
        title={upTo === 12 ? 'até a casa 19' : 'só até a casa 12'}
        className="flex w-9 shrink-0 flex-col items-center justify-center gap-1 rounded-r-xl text-sub transition-colors duration-150 hover:bg-surface-2 hover:text-text"
      >
        <span className="text-lg leading-none">{upTo === 12 ? '›' : '‹'}</span>
        <span className="font-mono text-[10px]">{upTo === 12 ? '19' : '12'}</span>
      </button>
    </div>
  )
}
