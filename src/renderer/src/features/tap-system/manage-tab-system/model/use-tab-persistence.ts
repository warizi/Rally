// Query Keys
export const sessionKeys = {
  all: ['session'] as const,
  session: (workspaceId: string) => [...sessionKeys.all, workspaceId] as const
}
