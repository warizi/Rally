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

export const FONT_SIZE_CHANGE_EVENT = 'app:font-size-change'

export function applyFontSize(size: FontSize): void {
  document.documentElement.style.fontSize = FONT_SIZE_MAP[size]
  window.dispatchEvent(new CustomEvent(FONT_SIZE_CHANGE_EVENT))
}
