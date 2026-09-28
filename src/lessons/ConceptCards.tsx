import { useEffect, useRef, useState } from 'react'
import { Button, cx } from '../ui/controls'
import { IconArrowLeft, IconArrowRight, IconBook, IconPlay } from '../ui/icons'
import { CARDS } from './cards'

/**
 * Cartões de conceito em sequência: uma frase e um desenho por cartão.
 * Qualquer tecla (ou clique) segue; ← volta; Esc fecha. O botão ouvir toca o
 * exemplo, quando há.
 */
export function ConceptCards({ ids, onClose, onGuide }: { ids: string[]; onClose: () => void; onGuide?: () => void }) {
  const [i, setI] = useState(0)
  const cards = ids.map((id) => CARDS[id]).filter(Boolean)
  const card = cards[i]
  const ref = useRef({ i, n: cards.length, onClose })
  ref.current = { i, n: cards.length, onClose }

  const next = () => (ref.current.i + 1 >= ref.current.n ? ref.current.onClose() : setI(ref.current.i + 1))
  const prev = () => setI((v) => Math.max(0, v - 1))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      // o resto da tela não vê estas teclas
      e.stopImmediatePropagation()
      if (e.key === 'Tab') return
      e.preventDefault()
      if (e.key === 'Escape') ref.current.onClose()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key.toLowerCase() === 'o' && card?.demo) card.demo()
      else next()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  if (!card) return null
  return (
    <div className="fixed inset-0 z-30 grid animate-fade-in place-items-center overflow-y-auto bg-bg/95 p-6 backdrop-blur-sm" role="dialog" aria-label="Conceito">
      <div key={i} className="flex w-full max-w-4xl animate-fade-in flex-col items-center gap-8 text-center">
        {card.art && <div className="flex min-h-56 w-full items-center justify-center sm:min-h-80">{card.art()}</div>}
        <p className="max-w-2xl text-2xl leading-snug font-medium text-balance sm:text-3xl">{card.text}</p>
        <div className="flex items-center gap-2">
          {cards.length > 1 &&
            cards.map((_, k) => <span key={k} className={cx('size-1.5 rounded-full', k === i ? 'bg-accent' : 'bg-line')} />)}
        </div>
        <div className="flex w-full max-w-sm items-center gap-2">
          <Button variant="ghost" onClick={prev} disabled={i === 0} aria-label="Voltar">
            <IconArrowLeft />
          </Button>
          {card.demo && (
            <Button onClick={card.demo} className="flex-1" title="Ouvir (O)">
              <IconPlay /> ouvir
            </Button>
          )}
          <Button variant="primary" onClick={next} className="flex-1" autoFocus>
            {i + 1 < cards.length ? 'seguir' : 'começar'} <IconArrowRight />
          </Button>
        </div>
        <span className="text-xs text-sub">qualquer tecla para seguir · ← volta</span>
        {onGuide && (
          <button type="button" onClick={onGuide} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-sub hover:bg-surface hover:text-text">
            <IconBook /> prefere ler com calma? abrir o guia
          </button>
        )}
      </div>
    </div>
  )
}
