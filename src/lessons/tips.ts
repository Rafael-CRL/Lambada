import { LESSON } from '../config'
import type { Note } from '../domain/notes'
import { staffStep } from '../domain/staff'

/**
 * Dicas quando o aluno erra muito: uma frase curta que lembra a regra
 * certa para o erro que ele está cometendo (a distância entre a nota
 * respondida e a certa diz qual é). Não bloqueiam nada.
 */
export type TipId = 'clave' | 'passo' | 'pulo' | 'do' | 'abaixo' | 'acima' | 'acidente'

export const TIPS: Record<TipId, string> = {
  clave: 'Lembre-se: a clave de sol é a referência. Ela se enrola na 2ª linha, então a 2ª linha é sempre Sol. Conte a partir dela.',
  passo: 'Lembre-se: linha e espaço se alternam, e cada vizinho é a nota seguinte. Do Sol, um acima é Lá; um abaixo, Fá.',
  pulo: 'Lembre-se: de uma linha para a linha seguinte, pula-se uma nota (Mi, Sol, Si). O mesmo vale de espaço para espaço.',
  do: 'Lembre-se: o Dó fica no 3º espaço, no meio da pauta. Para as notas de cima, conte a partir dele.',
  abaixo: 'Lembre-se: abaixo da pauta, conte a partir do Mi da 1ª linha, descendo: Ré, Dó, Si…',
  acima: 'Lembre-se: acima da pauta, conte a partir do Fá da 5ª linha, subindo: Sol, Lá, Si…',
  acidente: 'Lembre-se: o ♯ sobe meio tom e o ♭ desce meio tom, mas o nome da nota continua o mesmo.',
}

const LETTERS = 'CDEFGAB'

/** Distância em notas da resposta até a certa, pelo caminho mais curto (−3 a 3). */
export function letterDistance(answer: Pick<Note, 'letter'>, target: Pick<Note, 'letter'>): number {
  const d = (LETTERS.indexOf(answer.letter) - LETTERS.indexOf(target.letter) + 7) % 7
  return d > 3 ? d - 7 : d
}

/** Qual dica serve para este erro. `knowsDo`: a lição já apresentou o Dó do 3º espaço. */
export function tipFor(target: Note, answer: Pick<Note, 'letter' | 'acc'>, knowsDo: boolean, last: TipId | null): TipId {
  const step = staffStep(target)
  const d = letterDistance(answer, target)
  if (d === 0 && answer.acc !== target.acc) return 'acidente'
  if (step < 0) return 'abaixo'
  if (step > 8) return 'acima'
  if (Math.abs(d) === 2) return 'pulo'
  if (knowsDo && step >= 5) return 'do'
  // a referência primeiro; se não bastou, o passo
  return last === 'clave' ? 'passo' : 'clave'
}

/**
 * Quando mostrar: dois erros seguidos, ou muitos erros nas últimas
 * respostas; nunca duas dicas próximas.
 */
export class TipTrigger {
  private results: boolean[] = []
  private sinceTip = Infinity

  /** Registra uma resposta; true = hora de uma dica. */
  push(ok: boolean): boolean {
    this.results.push(ok)
    this.sinceTip++
    if (ok || this.sinceTip < LESSON.tipGap) return false
    const recent = this.results.slice(-LESSON.tipWindow)
    const streak = this.results.at(-2) === false
    const many = recent.filter((r) => !r).length >= LESSON.tipErrors
    if (!streak && !many) return false
    this.sinceTip = 0
    return true
  }
}
