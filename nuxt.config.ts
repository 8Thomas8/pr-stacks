import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  modules: ['reka-ui/nuxt', '@nuxtjs/i18n', '@nuxt/eslint'],
  ssr: false,
  devtools: { enabled: false },
  app: {
    head: {
      title: 'PR Stacks',
      link: [{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    },
  },
  // fonts are bundled so the desktop app works offline
  css: ['@fontsource-variable/geist', '@fontsource-variable/geist-mono', '@fontsource-variable/schibsted-grotesk', '~/assets/css/main.css'],
  devServer: { host: '127.0.0.1', port: 4321 },
  compatibilityDate: '2026-09-01',
  // Electron's main process imports the server and serves it through the app:// protocol (no port opened).
  nitro: { preset: 'node-listener', serveStatic: true, entry: fileURLToPath(new URL('./electron/nitro-entry.ts', import.meta.url)) },
  eslint: { config: { stylistic: true } },
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'en',
    locales: [
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'fr', language: 'fr-FR', name: 'Français', file: 'fr.json' },
    ],
    vueI18n: './i18n.config.ts',
    // the choice is kept in localStorage (see app.vue): cookies are not reliable on the app:// scheme
    detectBrowserLanguage: { useCookie: false, fallbackLocale: 'en' },
  },
})
