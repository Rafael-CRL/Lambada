import type { MutableRefObject, ReactNode } from 'react'
import type { Microphone } from '../audio/microphone'
import type { Settings } from '../db/db'
import type { Hud } from '../exercises/controller'
import type { Timbre } from '../exercises/types'
import type { LessonDef, LessonResult } from './lessons'

/** O que a tela da lição consegue pedir ao segmento em andamento. */
export interface SegmentHandle {
  /** "+ N" no fim: mais notas/trechos na mesma tela (se o segmento souber) */
  more?: (n: number) => void
  /** quantas respostas já foram dadas (para sair sem resumo) */
  answered: () => number
}

export interface SegmentProps<B> {
  lesson: LessonDef
  body: B
  settings: Settings
  mic: Microphone | null
  /** som dos botões (o mesmo da Leitura) */
  timbre: Timbre
  /** "?" aberto: o segmento espera */
  paused: boolean
  hud: Hud
  setHud: (patch: Partial<Hud>) => void
  onDone: (r: LessonResult) => void
  handle: MutableRefObject<SegmentHandle | null>
  /** ajustes da atividade (prática), acima dos botões */
  dock?: ReactNode
}
