export interface ShellAPI {
  openExternal: (url: string) => Promise<void>
}
