import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

function Icon({ children, ...p }: P) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...p}
    >
      {children}
    </svg>
  )
}

export const IconChart = (p: P) => (
  <Icon {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Icon>
)
export const IconGear = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Icon>
)
export const IconPause = (p: P) => (
  <Icon {...p}>
    <path d="M8 5v14M16 5v14" />
  </Icon>
)
export const IconPlay = (p: P) => (
  <Icon {...p}>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" strokeWidth={1.5} />
  </Icon>
)
export const IconX = (p: P) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)
export const IconMic = (p: P) => (
  <Icon {...p}>
    <rect x="9" y="2.5" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" />
  </Icon>
)
export const IconKeys = (p: P) => (
  <Icon {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="M6.5 9h1M11.5 9h1M16.5 9h1M6.5 12.5h1M11.5 12.5h1M16.5 12.5h1M8 16h8" />
  </Icon>
)
export const IconRedo = (p: P) => (
  <Icon {...p}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
  </Icon>
)
export const IconArrowRight = (p: P) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
)
export const IconSun = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
)
export const IconMoon = (p: P) => (
  <Icon {...p}>
    <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z" />
  </Icon>
)
export const IconTrophy = (p: P) => (
  <Icon {...p}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v4M8 21h8M9.5 18h5" />
  </Icon>
)
export const IconMetronome = (p: P) => (
  <Icon {...p}>
    <path d="M9.5 3h5l4 18h-13zM12 16l5-9M7 16.5h10" />
  </Icon>
)
export const IconHourglass = (p: P) => (
  <Icon {...p}>
    <path d="M6 3h12M6 21h12M7 3c0 5 10 6 10 9s-10 4-10 9M17 3c0 5-10 6-10 9s10 4 10 9" />
  </Icon>
)
export const IconSpeaker = (p: P) => (
  <Icon {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </Icon>
)
export const IconFrets = (p: P) => (
  <Icon {...p}>
    <path d="M3 7h18M3 12h18M3 17h18M7 5v14M13 5v14M19 5v14" strokeWidth={1.6} />
  </Icon>
)
export const IconArrowLeft = (p: P) => (
  <Icon {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
)
export const IconStaffMap = (p: P) => (
  <Icon {...p}>
    <path d="M3 6h18M3 10h18M3 14h18M3 18h18" strokeWidth={1.4} />
    <circle cx="8" cy="14" r="1.8" fill="currentColor" stroke="none" />
    <circle cx="16" cy="8" r="1.8" fill="currentColor" stroke="none" />
  </Icon>
)
export const IconLines = (p: P) => (
  <Icon {...p}>
    <path d="M3 6h18M3 10h18M3 14h18M3 18h18" strokeWidth={1.4} opacity={0.55} />
    <path d="M3 10h18" strokeWidth={2.2} />
  </Icon>
)
export const IconHelp = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.8M12 17.2v.1" />
  </Icon>
)
export const IconBook = (p: P) => (
  <Icon {...p}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" />
  </Icon>
)
export const IconNote = (p: P) => (
  <Icon {...p}>
    <ellipse cx="9" cy="17" rx="3.4" ry="2.5" transform="rotate(-20 9 17)" fill="currentColor" stroke="none" />
    <path d="M12.1 16V4.5" />
  </Icon>
)
