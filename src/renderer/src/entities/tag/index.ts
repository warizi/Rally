export type { TagItem, TaggableEntityType, CreateTagInput, UpdateTagInput } from './model/types'
export {
  TAG_KEY,
  ITEM_TAG_KEY,
  useTags,
  useItemTags,
  useItemIdsByTag,
  useCreateTag,
  useUpdateTag,
  useRemoveTag,
  useAttachTag,
  useDetachTag
} from './model/queries'
export { TagBadge } from './ui/TagBadge'
