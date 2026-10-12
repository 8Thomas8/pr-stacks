export default defineNuxtConfig({
  modules: ['reka-ui/nuxt', '@nuxtjs/i18n', '@nuxt/eslint'],
  ssr: false,
  devtools: { enabled: false },
  app: {
    head: {
      title: 'PR Stacks',
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@500;700;800&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap' },
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      ],
    },
  },
  css: ['~/assets/css/main.css'],
  devServer: { host: '127.0.0.1', port: 4321 },
  compatibilityDate: '2026-09-01',
  eslint: { config: { stylistic: true } },
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'en',
    locales: [
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'fr', language: 'fr-FR', name: 'Français', file: 'fr.json' },
    ],
    vueI18n: './i18n.config.ts',
    detectBrowserLanguage: { useCookie: true, cookieKey: 'stacks-lang', fallbackLocale: 'en', redirectOn: 'root' },
  },
})
