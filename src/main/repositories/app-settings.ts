import { eq } from 'drizzle-orm'
import { db } from '../db'
import { appSettings } from '../db/schema'

export const appSettingsRepository = {
  get(key: string): string | null {
    const row = db.select().from(appSettings).where(eq(appSettings.key, key)).get()
    return row?.value ?? null
  },

  set(key: string, value: string): void {
    db.insert(appSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value } })
      .run()
  }
}
