import hakunaPreset from '@hakunahq/ui/tokens/tailwind-preset'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [hakunaPreset],
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
    './node_modules/@hakunahq/ui/**/*.{js,jsx}',
  ],
}
