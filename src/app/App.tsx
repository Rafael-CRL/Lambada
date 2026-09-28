import type { ReactNode } from 'react'
import { saveSettings } from '../db/db'
import { ExerciseScreen } from '../exercises/ExerciseScreen'
import { LessonScreen } from '../lessons/LessonScreen'
import { Home } from '../screens/Home'
import { Progress } from '../screens/Progress'
import { SettingsScreen } from '../screens/Settings'
import { Summary } from '../screens/Summary'
import { ActivityList } from '../screens/ActivityList'
import { Explore } from '../screens/Explore'
import { RhythmPractice } from '../screens/RhythmPractice'
import { cx } from '../ui/controls'
import { IconChart, IconGear, IconMoon, IconSun } from '../ui/icons'
import { navigate, useRoute, type Route } from './router'
import { useSettings, useThemeSync } from './settings'

export function App() {
  const route = useRoute()
  const settings = useSettings()
  useThemeSync(settings.theme)

  if (route.name === 'play') {
    if (route.activity === 'explore') return <Explore key={route.run} />
    if (route.activity === 'rhythm') return <RhythmPractice key={route.run} />
    return <ExerciseScreen key={`${route.run}`} activityId={route.activity} />
  }
  if (route.name === 'lesson') return <LessonScreen key={`${route.lesson}-${route.run}`} lessonId={route.lesson} />

  return (
    <Shell route={route} theme={settings.theme}>
      {route.name === 'home' && <Home />}
      {route.name === 'topic' && <ActivityList key={route.topic} topic={route.topic} />}
      {route.name === 'summary' && <Summary id={route.id} />}
      {route.name === 'progress' && <Progress settings={settings} />}
      {route.name === 'settings' && <SettingsScreen settings={settings} />}
    </Shell>
  )
}

function Shell({ route, theme, children }: { route: Route; theme: 'dark' | 'light'; children: ReactNode }) {
  const navItem = (target: Route, label: string, icon: ReactNode) => (
    <a
      href={target.name === 'progress' ? '#/progress' : '#/settings'}
      aria-label={label}
      title={label}
      aria-current={route.name === target.name ? 'page' : undefined}
      className={cx(
        'grid size-10 place-items-center rounded-lg text-lg transition-colors duration-150 hover:bg-surface hover:text-text',
        route.name === target.name ? 'text-text' : 'text-sub',
      )}
    >
      {icon}
    </a>
  )
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4 pb-10 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <a
          href="#/"
          onClick={(e) => {
            e.preventDefault()
            navigate({ name: 'home' })
          }}
          className="group flex items-center gap-2.5 rounded-lg"
        >
          <Logo />
          <span className="text-xl font-semibold tracking-tight text-text group-hover:text-accent">lambada</span>
        </a>
        <nav className="flex items-center gap-1">
          {navItem({ name: 'progress' }, 'Progresso', <IconChart />)}
          {navItem({ name: 'settings' }, 'Configurações', <IconGear />)}
          <button
            type="button"
            aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
            title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            onClick={() => saveSettings({ theme: theme === 'dark' ? 'light' : 'dark' })}
            className="grid size-10 place-items-center rounded-lg text-lg text-sub transition-colors duration-150 hover:bg-surface hover:text-text"
          >
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
        </nav>
      </header>
      <main className="flex-1 animate-fade-in">{children}</main>
    </div>
  )
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
      <g className="stroke-line" strokeWidth={1.6}>
        <path d="M3 10h26M3 14h26M3 18h26M3 22h26" />
      </g>
      <ellipse cx="15" cy="16" rx="4.6" ry="3.4" transform="rotate(-20 15 16)" className="fill-accent" />
      <path d="M19.2 15V5.5" className="stroke-accent" strokeWidth={1.8} />
    </svg>
  )
}
