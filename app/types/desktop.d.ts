export interface DesktopPrefs { closeToTray: boolean, openAtLogin: boolean }
export type DesktopCommand = 'refresh' | 'preferences' | 'search' | 'view:graph' | 'view:list' | 'gh'

export interface DesktopBridge {
  platform: NodeJS.Platform
  info: () => Promise<DesktopPrefs & { version: string, platform: NodeJS.Platform, trayHost: boolean }>
  setPrefs: (patch: Partial<DesktopPrefs>) => Promise<DesktopPrefs>
  setTheme: (theme: 'system' | 'light' | 'dark') => void
  setLang: (lang: string) => void
  setAttention: (count: number, tip: string) => void
  show: () => void
  onCommand: (fn: (cmd: DesktopCommand, arg?: string) => void) => () => void
}

declare global {
  interface Window { desktop?: DesktopBridge }
}
