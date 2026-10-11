import { useId } from 'react'
import { motion } from 'framer-motion'
import ncLogo from '../assets/nc-logo.png'
import ncMark from '../assets/nc-mark.png'

/**
 * The NervCentre constellation: six stars that trace the "N" of the NERVCENTRE logo
 * (coordinates are pixels of the original logo, 2058 × 553). Each solved solution lights the next
 * star; when all six are lit the constellation glows and the logo appears under it.
 */
export const STAR_POINTS: [number, number][] = [
  [95, 470],
  [330, 150],
  [365, 480],
  [497, 318],
  [600, 150],
  [690, 95],
]
export const STAR_COUNT = STAR_POINTS.length

interface Props {
  /** Stars lit (0–6), in path order. */
  lit: number
  /** Logo under the stars: none, the N mark only, or the full logo with the wordmark. */
  logo?: 'none' | 'mark' | 'full'
  /** Light the stars one after another (reveal animation). */
  sequence?: boolean
  /** Pulse the next star to light. */
  showNext?: boolean
  className?: string
  title?: string
}

export function Constellation({ lit, logo = 'none', sequence = false, showNext = false, className = '', title }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const complete = lit >= STAR_COUNT
  const stepS = 0.32
  const delay = (i: number) => (sequence ? 0.25 + i * stepS : 0)
  const logoDelay = sequence ? 0.35 + STAR_COUNT * stepS : 0
  const full = logo === 'full'
  const viewBox = full ? '0 0 2058 553' : '20 20 760 540'
  const label = title ?? `${Math.min(lit, STAR_COUNT)} of ${STAR_COUNT} stars lit`

  return (
    <svg viewBox={viewBox} className={className} role="img" aria-label={label}>
      <defs>
        <radialGradient id={`g${uid}`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.25" stopColor="#cfaeea" stopOpacity="0.7" />
          <stop offset="0.6" stopColor="#763f98" stopOpacity="0.35" />
          <stop offset="1" stopColor="#763f98" stopOpacity="0" />
        </radialGradient>
        <filter id={`f${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {logo !== 'none' && (
        <motion.image
          href={full ? ncLogo : ncMark}
          x={0}
          y={0}
          width={full ? 2058 : 780}
          height={553}
          initial={{ opacity: complete ? 0 : 0.1 }}
          animate={{ opacity: complete ? 1 : 0.1 }}
          transition={{ delay: complete ? logoDelay : 0, duration: 0.9 }}
        />
      )}

      {/* Paths: faint guide lines, then the lit ones drawn in. */}
      <g>
        {STAR_POINTS.slice(0, -1).map(([x1, y1], i) => {
          const [x2, y2] = STAR_POINTS[i + 1]
          const on = i + 1 < lit
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9db4f2" strokeOpacity={complete && logo !== 'none' ? 0 : 0.22} strokeWidth={3} strokeDasharray="6 12" />
              {on && (
                <motion.line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={complete ? '#ffffff' : '#cfaeea'}
                  strokeWidth={complete ? 6 : 5}
                  strokeLinecap="round"
                  filter={`url(#f${uid})`}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: complete && logo !== 'none' ? 0.55 : 0.9 }}
                  transition={{ delay: delay(i + 1), duration: 0.35 }}
                />
              )}
            </g>
          )
        })}
      </g>

      {STAR_POINTS.map(([x, y], i) => {
        const on = i < lit
        const isNext = showNext && i === lit
        const tab = i === STAR_COUNT - 1
        return (
          <g key={i}>
            {on && (
              <motion.circle
                cx={x}
                cy={y}
                r={complete ? 62 : 48}
                fill={`url(#g${uid})`}
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: delay(i), duration: 0.45 }}
                style={{ transformOrigin: `${x}px ${y}px` }}
              />
            )}
            {isNext && (
              <circle cx={x} cy={y} r={26} fill="none" stroke="#bfd730" strokeWidth={3} className="animate-pulse-soft" />
            )}
            {on ? (
              <motion.g initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: delay(i), type: 'spring', stiffness: 260, damping: 16 }} style={{ transformOrigin: `${x}px ${y}px` }}>
                <path d={`M${x} ${y - 30} L${x + 5} ${y - 5} L${x + 30} ${y} L${x + 5} ${y + 5} L${x} ${y + 30} L${x - 5} ${y + 5} L${x - 30} ${y} L${x - 5} ${y - 5} Z`} fill="#ffffff" opacity={0.85} />
                <circle cx={x} cy={y} r={12} fill={tab ? '#3cd0c9' : '#ffffff'} stroke="#ffffff" strokeWidth={tab ? 4 : 0} />
              </motion.g>
            ) : (
              <circle cx={x} cy={y} r={9} fill="#9db4f2" fillOpacity={0.4} stroke="#9db4f2" strokeOpacity={0.6} strokeWidth={2} />
            )}
          </g>
        )
      })}
    </svg>
  )
}
