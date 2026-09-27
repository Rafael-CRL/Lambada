import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { DEFAULT_SETTINGS, loadSettings, type Settings } from '../db/db'

function storedTheme(): Settings['theme'] {
  try {
    return localStorage.getItem('lambada-theme') === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

const INITIAL: Settings = { ...DEFAULT_SETTINGS, theme: storedTheme() }

export function useSettings(): Settings {
  return useLiveQuery(loadSettings, [], INITIAL)
}

export function applyTheme(theme: Settings['theme']) {
  document.documentElement.dataset.theme = theme
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
  try {
    localStorage.setItem('lambada-theme', theme)
  } catch {
    /* sem storage */
  }
}

export function useThemeSync(theme: Settings['theme']) {
  useEffect(() => applyTheme(theme), [theme])
}
