import { useEffect, useState } from 'react'
import { cardsSeen, markCardsSeen } from '../db/db'

/** Cartões de uma atividade: abrem sozinhos na primeira vez; depois, só pelo "?". */
export function useFirstCards(key: string, cards: string[] | undefined): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!cards?.length) return
    let cancelled = false
    void cardsSeen(key).then((seen) => {
      if (cancelled || seen) return
      setOpen(true)
      void markCardsSeen(key)
    })
    return () => {
      cancelled = true
    }
  }, [key, cards])
  return [open, setOpen]
}
