export {
  STYLE_ELEMENT_KEYS,
  NOTE_STYLE_SETTINGS_KEY,
  ELEMENTS_WITH_BACKGROUND,
  ELEMENTS_WITH_BORDER,
  ELEMENTS_WITHOUT_TEXT,
  type ElementStyle,
  type StyleElementKey,
  type NoteStyleSet,
  type NoteStyleSettings
} from './model/types'
export { DEFAULT_NOTE_STYLE_SETTINGS } from './model/defaults'
export { buildNoteStyleCss, type BuildMode } from './model/build-css'
export { parseSize, formatSize, type SizeUnit, type SizeValue } from './model/size-value'
export { useNoteStyle, parseNoteStyleSettings } from './model/use-note-style'
export {
  useNoteStyleTemplates,
  useCreateNoteStyleTemplate,
  useDeleteNoteStyleTemplate,
  type NoteStyleTemplate
} from './api/templates'
