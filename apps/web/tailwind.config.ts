import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#0D0F12',
        s1:      '#1A1D23',
        s2:      '#22262E',
        s3:      '#2A2F3A',
        acc:     '#00C896',
        warn:    '#F5A623',
        danger:  '#E84545',
        info:    '#4A9EFF',
        purple:  '#A78BFA',
      },
      fontFamily: { mono: ['JetBrains Mono', 'Courier New', 'monospace'] },
    },
  },
  plugins: [],
}
export default config
