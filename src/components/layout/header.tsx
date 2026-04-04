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
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium">Admin</p>
            <p className="text-xs text-muted-foreground">admin@retail.com</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
            A
          </div>
        </div>
      </div>
    </header>
  )
}
