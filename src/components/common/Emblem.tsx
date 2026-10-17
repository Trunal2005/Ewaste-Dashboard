import React from 'react'

export function EwemEmblem({ className = 'size-9' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 rounded-lg bg-primary/10 border border-primary/30 text-primary ${className}`}>
      {/* Restrained circular-economy & circuit-trace emblem */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="size-5 text-primary transition-transform duration-300 hover:rotate-45"
      >
        {/* Recycler circular loop arrows */}
        <path
          d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L5.5 12"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M11 19h8.2a1.8 1.8 0 0 0 1.57-.881 1.784 1.784 0 0 0 .004-1.784L18.5 12"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Central circuit node */}
        <circle cx="12" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.7" fill="currentColor" fillOpacity="0.2" />
        {/* Circuit micro-traces */}
        <path d="M12 2.5V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 17V21.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M2.5 12H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M17 12H21.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {/* Tiny pulse dot */}
      <span className="absolute -top-0.5 -right-0.5 flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
        <span className="relative inline-flex size-2 rounded-full bg-primary"></span>
      </span>
    </div>
  )
}
