export type Actor = {
  kind: 'user' | 'ai'
  id?: string | null
}

export const USER_ACTOR: Actor = { kind: 'user', id: null }

export function toCreatedFields(actor: Actor): {
  createdBy: 'user' | 'ai'
  createdById: string | null
  updatedBy: 'user' | 'ai'
  updatedById: string | null
} {
  return {
    createdBy: actor.kind,
    createdById: actor.id ?? null,
    updatedBy: actor.kind,
    updatedById: actor.id ?? null
  }
}

export function toUpdatedFields(actor: Actor): {
  updatedBy: 'user' | 'ai'
  updatedById: string | null
} {
  return {
    updatedBy: actor.kind,
    updatedById: actor.id ?? null
  }
}
