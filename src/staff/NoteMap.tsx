import { memo, useMemo, useState } from 'react'
import { positionLabel, positionsOf } from '../domain/fretboard'
import { midiOf, namePt, namePtOctave, soundingFromWritten, type Note } from '../domain/notes'
import { guitarRangeNaturals, staffStep } from '../domain/staff'
import { StaffSvg } from './StaffSvg'

export type MapReach = 12 | 19

function positionsText(n: Note, maxFret: number): string {
  return positionsOf(midiOf(soundingFromWritten(n)), maxFret).map(positionLabel).join(' · ')
}

/**
 * Cola: todas as linhas e espaços que o violão alcança, com o nome de cada
 * nota. Até a casa 12 por padrão; a seta expande até a 19. Tocar/clicar numa
 * nota mostra as posições no braço. Fora da região praticada = mais apagada.
 */
export const NoteMap = memo(function NoteMap({
  region,
  reach,
  onReach,
}: {
  /** passos (pauta) da nota mais grave e mais aguda praticadas */
  region: [number, number]
  reach: MapReach
  onReach: (r: MapReach) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const notes = useMemo(() => guitarRangeNaturals(reach), [reach])
  const sel = notes.find((n) => `${n.letter}${n.octave}` === selected) ?? null

  const specs = useMemo(
    () =>
      notes.map((n) => {
        const key = `${n.letter}${n.octave}`
        const step = staffStep(n)
        return {
          key,
          note: n,
          draw: { figure: 'whole' as const },
          label: namePt(n),
          title: `${namePtOctave(n)}: ${positionsText(n, reach)}`,
          className: step >= region[0] && step <= region[1] ? '' : 'is-muted',
          selected: key === selected,
          onSelect: () => setSelected((s) => (s === key ? null : key)),
        }
      }),
    [notes, region, reach, selected],
  )

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-stretch gap-1 rounded-xl bg-surface/70 py-1 pl-2">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <StaffSvg
            className="h-auto w-full"
            style={{ minWidth: `${notes.length * 1.9 + 4}rem` }}
            spacing={30}
            ariaLabel={`Notas de cada linha e espaço até a casa ${reach}`}
            notes={specs}
          />
        </div>
        <button
          type="button"
          onClick={() => onReach(reach === 12 ? 19 : 12)}
          aria-label={reach === 12 ? 'Mostrar até a casa 19' : 'Mostrar só até a casa 12'}
          title={reach === 12 ? 'até a casa 19' : 'só até a casa 12'}
          className="flex w-9 shrink-0 flex-col items-center justify-center gap-1 rounded-r-xl text-sub transition-colors duration-150 hover:bg-surface-2 hover:text-text"
        >
          <span className="text-lg leading-none">{reach === 12 ? '›' : '‹'}</span>
          <span className="font-mono text-[10px]">{reach === 12 ? '19' : '12'}</span>
        </button>
      </div>
      <p className="min-h-5 text-center text-xs text-sub" aria-live="polite">
        {sel ? (
          <>
            <span className="text-text">{namePtOctave(sel)}</span> · {positionsText(sel, reach)}
          </>
        ) : (
          'toque numa nota para ver onde ela fica no braço'
        )}
      </p>
    </div>
  )
})
