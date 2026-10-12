import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    'vue/max-attributes-per-line': 'off',
    'vue/singleline-html-element-content-newline': 'off',
    'vue/multiline-html-element-content-newline': 'off',
    'vue/multi-word-component-names': ['error', { ignores: ['Icon', 'Tip'] }],
    'vue/html-self-closing': ['error', { html: { void: 'always', normal: 'never', component: 'always' } }],
  },
})
