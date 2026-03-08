export type Theme = 'light' | 'dark'

export type FontSize = 'small' | 'medium' | 'large'

const FONT_SIZE_MAP: Record<FontSize, string> = {
  small: '13px',
  medium: '15px',
  large: '17px'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function applyFontSize(size: FontSize): void {
  document.documentElement.style.fontSize = FONT_SIZE_MAP[size]
}
