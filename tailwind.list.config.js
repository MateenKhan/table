import base from './tailwind.config.js'

export default {
  ...base,
  content: ['./src/list/**/*.{ts,tsx}'],
  corePlugins: { ...base.corePlugins, preflight: false },
}
