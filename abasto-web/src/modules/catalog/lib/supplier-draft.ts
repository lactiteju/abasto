import type {
  CatalogSupplier,
  SupplierDraft,
} from '#/modules/catalog/lib/catalog-types'

export const emptySupplierDraft = (): SupplierDraft => ({
  name: '',
  contact: '',
  phone: '',
  notes: '',
  folioPrefix: '',
  active: true,
})

export const draftFromSupplier = (
  supplier: CatalogSupplier,
): SupplierDraft => ({
  name: supplier.name,
  contact: supplier.contact,
  phone: supplier.phone,
  notes: supplier.notes,
  folioPrefix: supplier.folioPrefix,
  active: supplier.active,
})
