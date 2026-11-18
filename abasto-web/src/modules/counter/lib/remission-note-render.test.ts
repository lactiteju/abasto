import { beforeEach, describe, expect, test } from 'bun:test'
import { db } from '#/db'
import { resetDatabase } from '#/db/testing'
import { buildRemissionNote } from '#/modules/counter/lib/remission-note'
import { renderRemissionNote } from '#/modules/counter/lib/remission-note-pdf'
import { pickupOrder } from '#/modules/orders/services/order-actions'
import { getOrder } from '#/modules/orders/services/order-reads'
import { createOrder } from '#/modules/orders/services/orders'
import {
  payCash,
  receive,
  setupOrders,
} from '#/modules/orders/services/testing'
import { buildSettlementNote } from '#/modules/riders/lib/settlement-note'
import {
  assignRider,
  settleAssignment,
} from '#/modules/riders/services/assignments'
import { setupRiders } from '#/modules/riders/services/testing'

beforeEach(() => resetDatabase(db))

/** Real data through the real notes and the real jsPDF + autotable renderer. */
describe('notes rendered end to end from real records', () => {
  test('a picked-up order prints original and copy on one sheet', async () => {
    const fx = await setupOrders()
    await receive(fx, { productId: fx.milkBox.id, quantity: 40 })
    const placed = await createOrder(fx.staffA, {
      warehouseId: fx.a.id,
      customerId: fx.customer.id,
      lines: [{ presentationId: fx.pieceId, quantity: 7 }],
    })
    await pickupOrder(fx.staffA, placed.id, payCash)
    const order = await getOrder(fx.staffA, placed.id)
    const note = buildRemissionNote(order, {
      business: 'Distribuidora de Lácteos',
      warehouseName: 'Tejupilco',
    })
    const doc = await renderRemissionNote(note)
    expect(doc.getNumberOfPages()).toBe(1)
    const pdf = doc.output()
    expect(pdf).toContain('Original')
    expect(pdf).toContain('Copia')
  })

  test('a settled reparto prints its nota on one sheet', async () => {
    const fx = await setupRiders()
    await receive(fx, { productId: fx.milkBox.id, quantity: 100 })
    const detail = await assignRider(fx.staffA, {
      riderId: fx.rider.id,
      lines: [{ productId: fx.milkBox.id, boxes: 1, units: 5 }],
    })
    const settled = await settleAssignment(fx.staffA, {
      assignmentId: detail.id,
      deliveredCents: 1_000,
      lines: [{ lineId: detail.lines[0].id, boxes: 0, units: 2 }],
    })
    const note = buildSettlementNote(settled, {
      business: 'Distribuidora de Lácteos',
      warehouseName: 'Tejupilco',
    })
    const doc = await renderRemissionNote(note)
    expect(doc.getNumberOfPages()).toBe(1)
    const pdf = doc.output()
    expect(pdf).toContain('Repartidor')
    expect(pdf).toContain('LIQUIDADO')
    expect(pdf).toContain('Faltante')
  })
})
