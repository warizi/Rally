import { createOwnWriteTracker } from '@shared/lib/create-own-write-tracker'

const tracker = createOwnWriteTracker()
export const markAsOwnWrite = tracker.markAsOwnWrite
export const isOwnWrite = tracker.isOwnWrite
