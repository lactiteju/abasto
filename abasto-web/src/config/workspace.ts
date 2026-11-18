/**
 * Workspace identity shown across the console shell. `business` holds only the
 * defaults: the owner edits the real value in Configuración (see the
 * `business` module).
 */
export const workspace = {
  appName: 'Panel del almacén',
  business: {
    name: 'Distribuidora de Lácteos',
    location: 'Tejupilco, Estado de México',
  },
} as const

export type Business = { name: string; location: string }
