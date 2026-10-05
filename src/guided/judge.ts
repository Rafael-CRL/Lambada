import { matchPitch, parseNote, type PitchMatch } from '../domain/notes'
import type { TimelineNote } from './catalog'

/** Julga ataques, nunca duração sustentada, dedo ou corda. Uma tentativa por nota. */
export class GuidedJudge {
  readonly results = new Map<number, PitchMatch>()
  readonly resolved = new Set<number>()
  readonly offsets: number[] = []
  constructor(readonly notes: TimelineNote[], readonly tolerance: number) {}
  get next(): number { return this.notes.findIndex((_, i) => !this.resolved.has(i)) }
  get attempts(): number { return this.results.size }
  get correct(): number { return [...this.results.values()].filter((r) => r === 'correct').length }

  answer(midi: number, time: number, free: boolean, at: (n: TimelineNote) => number): { index: number; result: PitchMatch; first: boolean } | null {
    let index = this.next
    if (!free) {
      index = -1
      for (let i = 0; i < this.notes.length; i++) {
        if (this.resolved.has(i)) continue
        const distance = Math.abs(time - at(this.notes[i]))
        if (distance <= this.tolerance && (index < 0 || distance < Math.abs(time - at(this.notes[index])))) index = i
      }
    }
    if (index < 0) return null
    const result = matchPitch(parseNote(this.notes[index].note!), midi + 12)
    const first = !this.results.has(index)
    if (first) this.results.set(index, result)
    if (!free || result === 'correct') this.resolved.add(index)
    if (!free && result === 'correct') this.offsets.push(time - at(this.notes[index]))
    return { index, result, first }
  }
  miss(index: number): boolean {
    if (this.resolved.has(index)) return false
    this.results.set(index, 'wrong')
    this.resolved.add(index)
    return true
  }
}
