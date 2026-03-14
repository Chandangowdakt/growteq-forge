import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(...inputs))
}

const CR = 10_000_000
const LAKH = 100_000

/** Format INR: >= 1 Cr as "₹X.XX Cr", >= 1 L as "₹X.XX L", else "₹X,XX,XXX" */
export function formatINR(amount: number): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '₹0'
  if (amount >= CR) return `₹${(amount / CR).toFixed(2)} Cr`
  if (amount >= LAKH) return `₹${(amount / LAKH).toFixed(2)} L`
  return `₹${Math.round(amount).toLocaleString('en-IN')}`
}

/** Format date as "DD MMM YYYY" (e.g. "14 Mar 2026") */
export function formatDate(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  if (Number.isNaN(d.getTime())) return '—'
  const day = d.getDate()
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const month = months[d.getMonth()]
  const year = d.getFullYear()
  return `${day} ${month} ${year}`
}
