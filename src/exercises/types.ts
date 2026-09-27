import type { InputKind } from '../engine/adaptive'

export type ConveyorFlow = 'wait' | 'continuous'
export type GuitarDrill = 'repeat' | 'scale' | 'adaptive'

export type ExerciseConfig =
  | { kind: 'conveyor'; flow: ConveyorFlow; input: InputKind }
  | { kind: 'sprint'; input: InputKind }
  | { kind: 'guitar'; drill: GuitarDrill }
  | { kind: 'bpm'; input: InputKind }

export function inputOf(config: ExerciseConfig): InputKind {
  return config.kind === 'guitar' ? 'mic' : config.input
}

/** Chave estável do modo (sem a entrada) para comparar sessões. */
export function modeKey(config: ExerciseConfig): string {
  switch (config.kind) {
    case 'conveyor':
      return `conveyor-${config.flow}:${config.input}`
    case 'sprint':
      return `sprint:${config.input}`
    case 'guitar':
      return `guitar-${config.drill}:mic`
    case 'bpm':
      return `bpm:${config.input}`
  }
}

const FLOW_LABEL: Record<ConveyorFlow, string> = { wait: 'Espera', continuous: 'Contínua' }
const DRILL_LABEL: Record<GuitarDrill, string> = { repeat: 'Repetição', scale: 'Escala', adaptive: 'Adaptativo' }
export const INPUT_LABEL: Record<InputKind, string> = { buttons: 'botões', mic: 'microfone' }

export function exerciseTitle(config: ExerciseConfig): string {
  switch (config.kind) {
    case 'conveyor':
      return `Esteira · ${FLOW_LABEL[config.flow]}`
    case 'sprint':
      return 'Sprint'
    case 'guitar':
      return `Violão · ${DRILL_LABEL[config.drill]}`
    case 'bpm':
      return 'BPM'
  }
}

export function exerciseSubtitle(config: ExerciseConfig): string {
  return config.kind === 'guitar' ? 'microfone' : INPUT_LABEL[config.input]
}
