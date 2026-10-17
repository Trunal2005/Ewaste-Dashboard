import React from 'react'

interface ProgressRingProps {
  progress: number // 0 to 100
  size?: number
  strokeWidth?: number
  className?: string
  label?: string
}

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 10,
  className = '',
  label = 'Readiness',
}: ProgressRingProps) {
  const normalizedProgress = Math.min(100, Math.max(0, progress))
  const center = size / 2
  const radius = center - strokeWidth / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (normalizedProgress / 100) * circumference

  return (
    <div className={`relative inline-flex flex-col items-center justify-center ${className}`}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-secondary dark:text-muted"
          fill="transparent"
        />
        {/* Progress active circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="#0ab1ba"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono text-2xl font-bold tracking-tight text-foreground">
          {normalizedProgress}%
        </span>
        <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  )
}
