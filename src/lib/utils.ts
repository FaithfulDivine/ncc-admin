import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

// ── VND currency ──
export function formatVND(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// ── vi-VN datetime format with optional seconds ──
export function formatDateTimeVN(iso: string | null, opts?: { showSeconds?: boolean }): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...(opts?.showSeconds ? { second: '2-digit' as const } : {}),
    hour12: false,
  })
}

// ── vi-VN short date (dd/MM) ──
export function formatDateVN(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

// ── ROAS format ("1.23×" or "—") ──
export function formatRoas(roas: number | null | undefined): string {
  const n = Number(roas ?? 0)
  return n > 0 ? `${n.toFixed(2)}×` : '—'
}

// Size sorting for COGS table
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']

export function sortSizes(a: string, b: string): number {
  const ai = SIZE_ORDER.indexOf(a.toUpperCase())
  const bi = SIZE_ORDER.indexOf(b.toUpperCase())
  if (ai !== -1 && bi !== -1) return ai - bi
  if (ai !== -1) return -1
  if (bi !== -1) return 1
  return a.localeCompare(b)
}
