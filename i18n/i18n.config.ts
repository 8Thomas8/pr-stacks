export default defineI18nConfig(() => ({
  pluralRules: {
    fr: (choice: number, choicesLength: number) => (choicesLength < 2 ? 0 : choice > 1 ? 1 : 0),
  },
}))
