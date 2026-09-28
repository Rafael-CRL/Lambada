/**
 * Batidas × notas do trecho. Cada batida casa com o ataque ainda livre mais
 * próximo dentro da tolerância; sobrando, é batida a mais. Ataque que passou
 * da tolerância sem batida é nota perdida. Tudo em segundos.
 */
export class TapJudge {
  /** desvio (s) de cada ataque casado; null = ainda sem batida */
  readonly hits: (number | null)[]
  /** instantes das batidas a mais */
  readonly extras: number[] = []

  constructor(
    /** instantes esperados dos ataques, em ordem */
    readonly times: number[],
    readonly tol: number,
  ) {
    this.hits = times.map(() => null)
  }

  /** Registra uma batida; devolve o índice do ataque casado ou null (batida a mais). */
  tap(t: number): number | null {
    let best: number | null = null
    for (let i = 0; i < this.times.length; i++) {
      if (this.hits[i] !== null) continue
      const d = Math.abs(t - this.times[i])
      if (d <= this.tol && (best === null || d < Math.abs(t - this.times[best]))) best = i
    }
    if (best === null) {
      this.extras.push(t)
      return null
    }
    this.hits[best] = t - this.times[best]
    return best
  }

  /** Ataques que já passaram da tolerância sem batida. */
  missedBy(now: number): number[] {
    return this.times.flatMap((t, i) => (this.hits[i] === null && now > t + this.tol ? [i] : []))
  }

  get matched(): number {
    return this.hits.filter((h) => h !== null).length
  }

  /** Pontos do trecho: acertos menos batidas a mais (nunca negativo), sobre o número de notas. */
  get score(): { correct: number; attempts: number } {
    return { correct: Math.max(0, this.matched - this.extras.length), attempts: this.times.length }
  }

  get perfect(): boolean {
    return this.matched === this.times.length && this.extras.length === 0
  }
}
