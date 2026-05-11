import { ipcRenderer } from 'electron'

export const itemTagApi = {
  getTagsByItem: (itemType: string, itemId: string) =>
    ipcRenderer.invoke('itemTag:getTagsByItem', itemType, itemId),
  getItemIdsByTag: (tagId: string, itemType: string) =>
    ipcRenderer.invoke('itemTag:getItemIdsByTag', tagId, itemType),
  attach: (itemType: string, tagId: string, itemId: string) =>
    ipcRenderer.invoke('itemTag:attach', itemType, tagId, itemId),
  detach: (itemType: string, tagId: string, itemId: string) =>
    ipcRenderer.invoke('itemTag:detach', itemType, tagId, itemId)
}
