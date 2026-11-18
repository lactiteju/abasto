import { workspace } from '#/config/workspace'

/** The store shows the business identity (persisted; these are the defaults). */
export const storeConfig = {
  name: workspace.business.name,
  location: workspace.business.location,
} as const

export const storeTitle = (page: string, name: string = storeConfig.name) =>
  `${page} · ${name}`
