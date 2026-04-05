'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  BarChart3,
  Settings,
  ChevronDown,
  Boxes,
  Tags,
  Ruler,
  ScrollText,
  History,
  Warehouse,
  BookOpen,
  AlertTriangle,
  Percent,
  UserCog,
  Plus,
} from 'lucide-react'
import { useState } from 'react'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

interface NavGroup {
  label: string
  icon: React.ReactNode
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-4 w-4" />,
    items: [{ label: 'Dashboard', href: '/', icon: <LayoutDashboard className="h-4 w-4" /> }],
  },
  {
    label: 'Inventory',
    icon: <Package className="h-4 w-4" />,
    items: [
      { label: 'Products', href: '/inventory/products', icon: <Boxes className="h-4 w-4" /> },
      { label: 'Categories', href: '/inventory/categories', icon: <Tags className="h-4 w-4" /> },
      { label: 'Units', href: '/inventory/units', icon: <Ruler className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Suppliers',
    icon: <Users className="h-4 w-4" />,
    items: [{ label: 'Suppliers', href: '/suppliers', icon: <Users className="h-4 w-4" /> }],
  },
  {
    label: 'Purchases',
    icon: <FileText className="h-4 w-4" />,
    items: [
      { label: 'Purchasing Bills', href: '/bills', icon: <ScrollText className="h-4 w-4" /> },
      { label: 'Bill History', href: '/bills/history', icon: <History className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Customers',
    icon: <Users className="h-4 w-4" />,
    items: [{ label: 'Customers', href: '/customers', icon: <Users className="h-4 w-4" /> }],
  },
  {
    label: 'Sales',
    icon: <FileText className="h-4 w-4" />,
    items: [
      { label: 'Sales Bills', href: '/sales', icon: <ScrollText className="h-4 w-4" /> },
      { label: 'New Sale', href: '/sales/new', icon: <Plus className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Reports',
    icon: <BarChart3 className="h-4 w-4" />,
    items: [
      { label: 'Stock Report', href: '/reports/stock', icon: <Warehouse className="h-4 w-4" /> },
      { label: 'Supplier Ledger', href: '/reports/supplier-ledger', icon: <BookOpen className="h-4 w-4" /> },
      { label: 'Customer Ledger', href: '/reports/customer-ledger', icon: <BookOpen className="h-4 w-4" /> },
      { label: 'Payables (Suppliers)', href: '/reports/payables', icon: <AlertTriangle className="h-4 w-4" /> },
      { label: 'Receivables (Customers)', href: '/reports/receivables', icon: <AlertTriangle className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Settings',
    icon: <Settings className="h-4 w-4" />,
    items: [
      { label: 'Tax Configuration', href: '/settings', icon: <Percent className="h-4 w-4" /> },
      { label: 'Preferences', href: '/settings/preferences', icon: <UserCog className="h-4 w-4" /> },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Dashboard: true,
    Inventory: true,
    Suppliers: true,
    Customers: true,
    Bills: true,
    Sales: true,
    Reports: true,
    Settings: true,
  })

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card">
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Package className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">Retail Management</h1>
            <p className="text-[10px] text-muted-foreground">Hardware Store</p>
          </div>
        </Link>
      </div>

      <nav className="space-y-1 p-4">
        {navGroups.map((group) => {
          const isActive = group.items.some((item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)))
          const hasMultiple = group.items.length > 1

          return (
            <div key={group.label}>
              {hasMultiple ? (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {group.icon}
                    <span>{group.label}</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-3 w-3 transition-transform',
                      openGroups[group.label] ? 'rotate-180' : ''
                    )}
                  />
                </button>
              ) : (
                <Link
                  href={group.items[0].href}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                >
                  {group.icon}
                  <span>{group.label}</span>
                </Link>
              )}

              {openGroups[group.label] && hasMultiple && (
                <div className="ml-6 mt-1 space-y-1">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                          ? 'bg-accent text-accent-foreground font-medium'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                      )}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
