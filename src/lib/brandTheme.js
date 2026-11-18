import { LOGO_C2, BRAND_NAME, LOGO_TEXT } from '../brand'
import { getSetting } from './platform'

const KEY = 'sm_login_theme'
let memory = null

export function readCachedTheme() {
  if (memory) return memory
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) memory = JSON.parse(raw)
  } catch (_) {
    memory = null
  }
  return memory || {}
}

export function cacheTheme(theme) {
  if (!theme || typeof theme !== 'object') return
  memory = { ...readCachedTheme(), ...theme }
  try {
    localStorage.setItem(KEY, JSON.stringify(memory))
  } catch (_) {}
}

/** Resolved logo URL for in-app chrome (sidebar, super admin, login fallback). */
export function resolveBrandLogo(theme) {
  const t = theme || readCachedTheme()
  const custom = t.brand_logo_url && String(t.brand_logo_url).trim()
  if (custom) return custom
  return LOGO_C2
}

export function resolveBrandName(theme) {
  const t = theme || readCachedTheme()
  return (t.brand_name && String(t.brand_name).trim()) || BRAND_NAME
}

export function resolveLogoText(theme) {
  const t = theme || readCachedTheme()
  return (t.logo_text && String(t.logo_text).trim()) || LOGO_TEXT || 'SM'
}

/** Load theme from platform_settings and cache for whole app. */
export async function loadPlatformTheme() {
  try {
    const th = await getSetting('theme')
    if (th && typeof th === 'object') {
      cacheTheme(th)
      return th
    }
  } catch (_) {}
  return readCachedTheme()
}
