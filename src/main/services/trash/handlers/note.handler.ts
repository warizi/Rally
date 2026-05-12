import { noteRepository } from '../../../repositories/note'
import { createFileHandler } from './file-handler.factory'

/** note — workspace/path/{relativePath}.md → trash/batchId/{relativePath}.md */
export const noteHandler = createFileHandler('note', noteRepository)
