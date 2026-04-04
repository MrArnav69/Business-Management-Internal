import NepaliDate from 'nepali-date-converter'

export function adToBs(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const nepaliDate = new NepaliDate(d)
  const year = nepaliDate.getYear()
  const month = String(nepaliDate.getMonth() + 1).padStart(2, '0')
  const day = String(nepaliDate.getDate()).padStart(2, '0')
  return `${year}/${month}/${day}`
}

export function bsToAd(bsDate: string): Date {
  const [year, month, day] = bsDate.split('/').map(Number)
  const nepaliDate = new NepaliDate(year, month - 1, day)
  return nepaliDate.toJsDate()
}

export function formatBsDate(bsDate: string): string {
  return bsDate
}

export function getCurrentBsDate(): string {
  return adToBs(new Date())
}

export function getCurrentAdDate(): string {
  return new Date().toISOString().split('T')[0]
}

export function getCurrentTime(): string {
  return new Date().toTimeString().split(' ')[0]
}

export function getNepaliYear(): number {
  const nepaliDate = new NepaliDate(new Date())
  return nepaliDate.getYear()
}

export function formatNPR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'NPR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatQuantity(qty: number | null): string {
  if (qty === null || qty === undefined) return '—'
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(qty)
}
