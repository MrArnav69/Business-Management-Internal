'use client'

import { getCurrentBsDate } from '@/lib/nepali-date'
import { format } from 'date-fns'

export function Header() {
  const todayBS = getCurrentBsDate()
  const todayAD = format(new Date(), 'EEEE, MMMM d, yyyy')

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex h-16 items-center justify-between px-6">
        <div>
          <h2 className="text-lg font-semibold">Welcome back</h2>
          <p className="text-xs text-muted-foreground">
            {todayAD} | BS: {todayBS}
          </p>
        </div>

      </div>
    </header>
  )
}
