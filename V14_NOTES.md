# EduMoja v14 — PWA smoothness

## Install
- Full **Install app** only on **HTTPS** (Netlify) or **localhost / 127.0.0.1**
- Termux over LAN IP (192.168 / 172.x) → Chrome blocks beforeinstallprompt; use production URL or 127.0.0.1
- iOS: Safari Share → Add to Home Screen

## Service worker (`public/sw.js`)
- Cache name: `edumoja-shell-v14`
- Never caches Supabase / IntaSend / Netlify functions
- Navigate: network-first → cached index → offline.html
- `/assets/*`: cache-first + background refresh
- Activates with skipWaiting + clients.claim

## Netlify
- `sw.js` + `index.html` + manifest: `must-revalidate`
- `/assets/*`: long-cache immutable

## After deploy
Hard-refresh once or clear site data if an old SW sticks. Then Add to Home Screen again if the icon is stale.
