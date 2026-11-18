import { PageHeading } from '#/components/page-heading'
import { BusinessSection } from '#/modules/business/components/business-section'
import { NewUserDialog } from '#/modules/access/components/new-user-dialog'
import { UsersSection } from '#/modules/access/components/users-section'
import type { ManagedUser } from '#/modules/access/services/access'
import type { Warehouse } from '#/modules/warehouses/services/warehouses'

type SettingsPageProps = {
  users: Array<ManagedUser>
  warehouses: Array<Warehouse>
}

/** Owner-only; the route redirects everyone else before this renders. */
export function SettingsPage({ users, warehouses }: SettingsPageProps) {
  return (
    <>
      <PageHeading
        title="Configuración"
        description="Los datos del negocio y quién opera cada almacén."
        actions={<NewUserDialog />}
      />
      <BusinessSection />
      <UsersSection users={users} warehouses={warehouses} />
    </>
  )
}
