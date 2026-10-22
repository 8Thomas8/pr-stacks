import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, protocol, screen, session, shell, Tray } from 'electron'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const ASSETS = join(HERE, 'assets')
// ignored once installed: it would load any URL as a trusted origin
const DEV_URL = app.isPackaged ? undefined : process.env.ELECTRON_DEV_URL
const DEV_ORIGIN = DEV_URL && new URL(DEV_URL).origin
const APP_ID = 'io.github.8thomas8.prstacks'
const ORIGIN = 'app://pr-stacks'
const IS_MAC = process.platform === 'darwin'
const IS_WIN = process.platform === 'win32'
// Height of the toolbar that doubles as the title bar (keep in sync with --title-h in main.css).
const TITLE_H = 52
// the toolbar has no wrap: past ×1.2 it no longer fits the 960px minimum width
const MAX_ZOOM = 1
const THEME = {
  light: { bg: '#EBEEF3', bar: '#FFFFFF', symbol: '#3C4454' },
  dark: { bg: '#0A0C11', bar: '#1A1F29', symbol: '#BCC4D2' },
}

// the installed app is not a debug target (the fuses already block --inspect & co., see electron-builder.yml)
if (app.isPackaged && ['remote-debugging-port', 'remote-debugging-pipe'].some(s => app.commandLine.hasSwitch(s))) {
  app.exit(1)
  process.exit(1)
}
if (!app.requestSingleInstanceLock()) {
  app.exit(0)
  process.exit(0)
}
if (IS_WIN) app.setAppUserModelId(APP_ID)
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }])

// GUI apps launched from the Dock / a desktop entry don't inherit the shell PATH, so `gh` installed
// through Homebrew, Linuxbrew, asdf… would not be found. Merge the login shell's PATH in (read through
// `env` so fish, whose $PATH is a list, works too). Runs while the server loads, not blocking startup.
const pathFixed = new Promise((resolve) => {
  if (IS_WIN) return resolve()
  execFile(process.env.SHELL || '/bin/sh', ['-ilc', 'env'], { encoding: 'utf8', timeout: 4000 }, (_err, stdout = '') => {
    const shellPath = stdout.split('\n').find(l => l.startsWith('PATH='))?.slice(5) ?? ''
    const extra = ['/opt/homebrew/bin', '/usr/local/bin', '/home/linuxbrew/.linuxbrew/bin', join(homedir(), '.local/bin')]
    const parts = [...(process.env.PATH ?? '').split(delimiter), ...shellPath.split(delimiter), ...extra].filter(Boolean)
    process.env.PATH = [...new Set(parts)].join(delimiter)
    resolve()
  })
})

// Stock GNOME has no notification area (it takes the AppIndicator extension): closing to the tray there
// would leave the app running out of sight. Asked again on each close, the extension can be turned on later.
const hasTrayHost = () => new Promise((resolve) => {
  if (process.platform !== 'linux') return resolve(true)
  const args = ['call', '--session', '--dest', 'org.freedesktop.DBus', '--object-path', '/org/freedesktop/DBus', '--method', 'org.freedesktop.DBus.NameHasOwner', 'org.kde.StatusNotifierWatcher']
  // no gdbus or no session bus: can't tell, keep the tray behaviour
  execFile('gdbus', args, { encoding: 'utf8', timeout: 2000 }, (err, stdout) => resolve(err ? true : stdout.includes('true')))
})
let trayHost = true

/* ---------- preferences owned by the main process ---------- */

const PREFS_FILE = join(app.getPath('userData'), 'desktop.json')
const prefs = { closeToTray: true, openAtLogin: false, bounds: null, maximized: false }
try {
  Object.assign(prefs, JSON.parse(readFileSync(PREFS_FILE, 'utf8')))
}
catch { /* first launch */ }
function savePrefs() {
  try {
    mkdirSync(dirname(PREFS_FILE), { recursive: true })
    writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 2))
  }
  catch (e) { console.error('Could not save preferences', e) }
}

// Electron's login items only cover macOS and Windows; Linux uses an XDG autostart entry.
function applyOpenAtLogin(on) {
  if (process.platform !== 'linux') {
    app.setLoginItemSettings({ openAtLogin: on, args: ['--hidden'] })
    return
  }
  const file = join(homedir(), '.config', 'autostart', 'pr-stacks.desktop')
  if (!on || !app.isPackaged) return rmSync(file, { force: true })
  // APPIMAGE is only ours when this process runs from the mounted AppImage (it can leak from a parent one)
  const inAppImage = process.env.APPIMAGE && process.env.APPDIR && process.execPath.startsWith(process.env.APPDIR)
  const exec = inAppImage ? process.env.APPIMAGE : process.execPath
  // Desktop Entry quoting: escape " ` $ \ inside the quotes, and % is a field code
  const quoted = `"${exec.replace(/["`$\\]/g, '\\$&').replace(/%/g, '%%')}"`
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `[Desktop Entry]\nType=Application\nName=PR Stacks\nExec=${quoted} --hidden\nX-GNOME-Autostart-enabled=true\n`)
}

/* ---------- window ---------- */

let win = null
let tray = null
let quitting = false
let ready = false
let attention = { count: 0, tip: '' }

const palette = () => THEME[nativeTheme.shouldUseDarkColors ? 'dark' : 'light']
const visibleOnSomeScreen = b => screen.getAllDisplays().some(({ workArea: a }) => b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y)
// macOS login items can't pass arguments, opened-at-login means the --hidden we ask for elsewhere
let startHidden = process.argv.includes('--hidden')
const isApp = url => url.startsWith(`${ORIGIN}/`) || (!!DEV_ORIGIN && URL.canParse(url) && new URL(url).origin === DEV_ORIGIN)

function createWindow() {
  const bounds = prefs.bounds && visibleOnSomeScreen(prefs.bounds) ? prefs.bounds : { width: 1440, height: 900 }
  const p = palette()
  win = new BrowserWindow({
    ...bounds,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'PR Stacks',
    icon: IS_MAC ? undefined : join(ASSETS, 'icon.png'),
    backgroundColor: p.bg,
    titleBarStyle: 'hidden',
    ...(IS_MAC
      ? { trafficLightPosition: { x: 18, y: Math.round((TITLE_H - 16) / 2) } }
      : { titleBarOverlay: { color: p.bar, symbolColor: p.symbol, height: TITLE_H - 1 } }),
    webPreferences: {
      preload: join(HERE, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      // keep auto-sync and notifications running while the window sits in the tray
      backgroundThrottling: false,
      spellcheck: false,
    },
  })
  // maximize() also shows the window, so it waits until the window is meant to be seen
  win.once('ready-to-show', () => {
    if (startHidden) return
    if (prefs.maximized) win.maximize()
    win.show()
  })
  const keepBounds = () => {
    if (!win.isMaximized() && !win.isMinimized() && !win.isFullScreen()) prefs.bounds = win.getBounds()
    prefs.maximized = win.isMaximized()
  }
  win.on('resize', keepBounds)
  win.on('move', keepBounds)
  win.on('close', (e) => {
    savePrefs()
    if (quitting || !(prefs.closeToTray || IS_MAC)) return
    e.preventDefault()
    hasTrayHost().then((ok) => {
      trayHost = ok
      if (!win) return
      if (ok) return win.hide()
      quitting = true
      app.quit()
    })
  })
  win.on('closed', () => {
    win = null
  })
  // Windows logoff/shutdown doesn't emit before-quit: let the window close instead of hiding
  win.on('query-session-end', () => {
    quitting = true
  })

  // Links to GitHub & co. open in the user's browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (isApp(url)) return
    e.preventDefault()
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
  })
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return
    const mod = IS_MAC ? input.meta : input.control
    const zoom = win.webContents.getZoomLevel()
    // digits by physical key: on AZERTY `key` is à & é…
    if (mod && (input.key === '=' || input.key === '+' || input.code === 'NumpadAdd')) win.webContents.setZoomLevel(Math.min(zoom + 0.5, MAX_ZOOM))
    else if (mod && (input.key === '-' || input.code === 'NumpadSubtract')) win.webContents.setZoomLevel(Math.max(zoom - 0.5, -2))
    else if (mod && (input.code === 'Digit0' || input.code === 'Numpad0')) win.webContents.setZoomLevel(0)
    else if (!app.isPackaged && (input.key === 'F12' || (mod && input.shift && input.key.toLowerCase() === 'i'))) win.webContents.toggleDevTools()
    else return
    e.preventDefault()
  })

  win.loadURL(DEV_URL || `${ORIGIN}/`)
}

function showWindow() {
  if (!ready) return
  startHidden = false
  if (!win) createWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}
const send = (cmd, arg) => {
  showWindow()
  win.webContents.send('command', cmd, arg)
}

function applyPalette() {
  const p = palette()
  if (!win || IS_MAC) return
  win.setBackgroundColor(p.bg)
  win.setTitleBarOverlay({ color: p.bar, symbolColor: p.symbol, height: TITLE_H - 1 })
}

/* ---------- tray, badge, taskbar overlay ---------- */

const img = name => nativeImage.createFromPath(join(ASSETS, name))
function trayIcon() {
  const alert = attention.count > 0
  if (IS_MAC) {
    const i = img(alert ? 'trayAlertTemplate.png' : 'trayTemplate.png')
    i.setTemplateImage(true)
    return i
  }
  // Linux trays rarely honour @2x variants, hand them the bigger bitmap directly.
  return img(`${alert ? 'tray-alert' : 'tray'}${process.platform === 'linux' ? '@2x' : ''}.png`)
}

function updateAttention() {
  const { count, tip } = attention
  tray?.setImage(trayIcon())
  tray?.setToolTip(tip || 'PR Stacks')
  if (IS_MAC || process.platform === 'linux') app.setBadgeCount(count)
  if (IS_WIN && win) win.setOverlayIcon(count ? img('badge.png') : null, count ? tip : '')
  if (tray) tray.setContextMenu(trayMenu())
}

function trayMenu() {
  return Menu.buildFromTemplate([
    { label: 'PR Stacks', enabled: false },
    ...(attention.tip ? [{ label: attention.tip, enabled: false }] : []),
    { type: 'separator' },
    { label: L().show, click: showWindow },
    { label: L().refresh, click: () => send('refresh') },
    { label: L().prefs, click: () => send('preferences') },
    { type: 'separator' },
    { label: L().quit, click: () => app.quit() },
  ])
}

function createTray() {
  tray = new Tray(trayIcon())
  tray.setToolTip('PR Stacks')
  tray.setContextMenu(trayMenu())
  // macOS opens the menu on click; elsewhere a click brings the window back.
  if (!IS_MAC) tray.on('click', () => (win?.isVisible() && win.isFocused() ? win.hide() : showWindow()))
}

/* ---------- menu (macOS menu bar; on Windows/Linux the toolbar replaces it) ---------- */

const STRINGS = {
  en: { show: 'Show PR Stacks', refresh: 'Refresh', prefs: 'Preferences…', quit: 'Quit PR Stacks', view: 'View', graph: 'Stacks', list: 'List', search: 'Search', gh: 'GitHub CLI status', site: 'PR Stacks on GitHub', ghSite: 'GitHub CLI website' },
  fr: { show: 'Afficher PR Stacks', refresh: 'Rafraîchir', prefs: 'Préférences…', quit: 'Quitter PR Stacks', view: 'Présentation', graph: 'Piles', list: 'Liste', search: 'Rechercher', gh: 'État de GitHub CLI', site: 'PR Stacks sur GitHub', ghSite: 'Site de GitHub CLI' },
}
let lang = 'en'
const L = () => STRINGS[lang]

function buildMenu() {
  if (!IS_MAC) return Menu.setApplicationMenu(null)
  // Shortcuts are handled by the page (they work the same on every OS), the menu only displays them.
  const item = (label, accelerator, cmd) => ({ label, accelerator, registerAccelerator: false, click: () => send(cmd) })
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu', submenu: [
      { role: 'about' }, { type: 'separator' },
      item(L().prefs, 'Cmd+,', 'preferences'), { type: 'separator' },
      { role: 'services' }, { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' },
      { role: 'quit', label: L().quit },
    ] },
    { role: 'editMenu' },
    { label: L().view, submenu: [
      item(L().graph, 'Cmd+1', 'view:graph'), item(L().list, 'Cmd+2', 'view:list'), { type: 'separator' },
      item(L().search, 'Cmd+F', 'search'), item(L().refresh, 'Cmd+R', 'refresh'), { type: 'separator' },
      { role: 'togglefullscreen' },
    ] },
    { role: 'windowMenu' },
    { role: 'help', submenu: [
      item(L().gh, undefined, 'gh'),
      { label: L().site, click: () => shell.openExternal('https://github.com/8Thomas8/pr-stacks') },
      { label: L().ghSite, click: () => shell.openExternal('https://cli.github.com') },
    ] },
  ]))
}

/* ---------- IPC ---------- */

// only the app's own page may talk to the main process
const trusted = e => isApp(e.senderFrame?.url ?? '')
const on = (channel, fn) => ipcMain.on(channel, (e, ...args) => trusted(e) && fn(...args))
const handle = (channel, fn) => ipcMain.handle(channel, (e, ...args) => (trusted(e) ? fn(...args) : null))

handle('desktop:info', async () => {
  trayHost = await hasTrayHost()
  return { version: app.getVersion(), platform: process.platform, closeToTray: prefs.closeToTray, openAtLogin: prefs.openAtLogin, trayHost }
})
handle('desktop:prefs', (patch) => {
  if (typeof patch?.closeToTray === 'boolean') prefs.closeToTray = patch.closeToTray
  if (typeof patch?.openAtLogin === 'boolean') {
    prefs.openAtLogin = patch.openAtLogin
    applyOpenAtLogin(patch.openAtLogin)
  }
  savePrefs()
  return { closeToTray: prefs.closeToTray, openAtLogin: prefs.openAtLogin }
})
on('desktop:theme', (theme) => {
  if (['system', 'light', 'dark'].includes(theme)) nativeTheme.themeSource = theme
})
on('desktop:lang', (l) => {
  if (!STRINGS[l] || l === lang) return
  lang = l
  buildMenu()
  tray?.setContextMenu(trayMenu())
})
on('desktop:attention', (a) => {
  attention = { count: Math.max(0, Number(a?.count) || 0), tip: String(a?.tip ?? '').slice(0, 120) }
  updateAttention()
})
on('desktop:show', showWindow)

/* ---------- lifecycle ---------- */

app.on('second-instance', showWindow)
app.on('activate', showWindow)
app.on('before-quit', () => {
  quitting = true
})
app.on('window-all-closed', () => {
  if (!IS_MAC && !prefs.closeToTray) app.quit()
})
nativeTheme.on('updated', applyPalette)

// PR descriptions are rendered as HTML: if sanitizing ever failed, the page still can't send data anywhere.
const CSP = [
  `default-src 'self'`,
  // Nuxt inlines its payload and import map
  `script-src 'self' 'unsafe-inline'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: https://*.githubusercontent.com https://github.com`,
  `font-src 'self' data:`,
  `connect-src 'self'`,
  `object-src 'none'`,
  `frame-src 'none'`,
  `base-uri 'none'`,
  `form-action 'none'`,
].join('; ')

async function serve(handler, req) {
  const res = await handler(req)
  if (!res.headers.get('content-type')?.startsWith('text/html')) return res
  const headers = new Headers(res.headers)
  headers.set('content-security-policy', CSP)
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

app.whenReady().then(async () => {
  lang = app.getLocale().startsWith('fr') ? 'fr' : 'en'
  startHidden ||= IS_MAC && app.getLoginItemSettings().wasOpenedAtLogin
  // notifications for the alerts, clipboard for the copy buttons; nothing else (camera, location…)
  const allowed = new Set(['notifications', 'clipboard-sanitized-write'])
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(allowed.has(permission)))
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission))
  try {
    if (!DEV_URL) {
      const entry = join(ROOT, '.output', 'server', 'index.mjs')
      if (!existsSync(entry)) throw new Error('Missing .output/, run `npm run build` first')
      const { handler } = await import(pathToFileURL(entry).href)
      protocol.handle('app', req => serve(handler, req))
    }
    await pathFixed
    trayHost = await hasTrayHost()
  }
  catch (e) {
    dialog.showErrorBox('PR Stacks could not start', String(e?.stack || e))
    app.exit(1)
    return
  }
  // packaged builds get the .icns from electron-builder
  if (IS_MAC && !app.isPackaged) app.dock?.setIcon(join(ASSETS, 'icon.png'))
  // opened at login with nowhere to sit: show the window rather than run invisible
  if (!trayHost) startHidden = false
  ready = true
  buildMenu()
  createTray()
  createWindow()
})
