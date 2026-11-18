/** PWA install — HTTPS / localhost full prompt; HTTP LAN gets clear fallback. */

let deferred = null
const listeners = new Set()

function notify() {
  listeners.forEach((fn) => {
    try {
      fn(canInstall())
    } catch (_) {}
  })
}

export function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  )
}

/** Chrome only fires beforeinstallprompt on secure contexts (HTTPS or localhost). */
export function isInstallableContext() {
  if (typeof window === 'undefined') return false
  try {
    if (window.isSecureContext) return true
  } catch (_) {}
  const h = window.location?.hostname || ''
  return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.localhost')
}

export function canInstall() {
  return !!(deferred && !isStandalone())
}

export function onInstallAvailability(fn) {
  listeners.add(fn)
  try {
    fn(canInstall())
  } catch (_) {}
  return () => listeners.delete(fn)
}

export function initInstallCapture() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    try {
      sessionStorage.setItem('em_installed', '1')
    } catch (_) {}
    notify()
  })
  // Re-check display mode after orientation / task switch
  try {
    window.matchMedia('(display-mode: standalone)').addEventListener('change', notify)
  } catch (_) {}
}

export async function promptInstall() {
  if (!deferred) return false
  const e = deferred
  try {
    e.prompt()
    const choice = await e.userChoice
    deferred = null
    notify()
    return choice?.outcome === 'accepted'
  } catch (_) {
    deferred = null
    notify()
    return false
  }
}

export function getInstallHelp() {
  if (typeof window === 'undefined') return 'Open in Chrome or Safari to install.'

  const host = window.location?.hostname || ''
  const insecureLan =
    !isInstallableContext() &&
    (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes('192.168') || host.includes('172.'))

  if (isStandalone()) {
    return 'EduMoja is already running as an installed app.'
  }

  if (insecureLan) {
    return (
      'Install is blocked on plain HTTP over Wi‑Fi (e.g. 172.x.x.x:5173).\n\n' +
      'Chrome only allows Install app on HTTPS or on localhost.\n\n' +
      'Do one of these:\n' +
      '1) Production: open your HTTPS Netlify URL in Chrome → Menu ⋮ → Install app.\n' +
      '2) Phone testing: use http://127.0.0.1:5173 on the same device (Termux), not the LAN IP.\n' +
      '3) Or Chrome → Menu ⋮ → Add to Home screen (shortcut until HTTPS).'
    )
  }

  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    return 'iPhone/iPad (Safari only): Share → Add to Home Screen. That installs EduMoja like an app.'
  }

  if (/Android/i.test(navigator.userAgent)) {
    return (
      'Android Chrome:\n' +
      '1) Stay on this site in Chrome (not WhatsApp/Facebook in-app browser).\n' +
      '2) Menu ⋮ → Install app OR Add to Home screen.\n' +
      'If you only see Create shortcut, open the HTTPS production URL for full install.\n' +
      'Already installed? Open the home-screen icon for full-screen mode.'
    )
  }

  return 'Desktop Chrome/Edge: install icon in the address bar, or menu → Install EduMoja…'
}

/** Register SW + soft update when a new worker waits. */
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  const onLoad = () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        // Hourly update check while tab open
        setInterval(() => {
          try {
            reg.update()
          } catch (_) {}
        }, 60 * 60 * 1000)

        reg.addEventListener('updatefound', () => {
          const nw = reg.installing
          if (!nw) return
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              // New version ready — activate on next navigation; optional soft prompt
              try {
                sessionStorage.setItem('em_sw_update', '1')
              } catch (_) {}
            }
          })
        })
      })
      .catch(() => {})
  }

  if (document.readyState === 'complete') onLoad()
  else window.addEventListener('load', onLoad)
}
