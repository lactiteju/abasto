import { useState } from 'react'

import type {
  ProductMetric,
  ProductSort,
} from '#/modules/reports/components/monthly/monthly-chart-math'
import { MonthlyProductList } from '#/modules/reports/components/monthly/monthly-product-list'
import type { MonthlyResults } from '#/modules/reports/types/monthly-results'

type Props = { results: MonthlyResults }

/** "Productos" at full width: ranking chips, measure switch and bars. */
export function MonthlyProducts({ results }: Props) {
  const [sort, setSort] = useState<ProductSort>('mas')
  const [metric, setMetric] = useState<ProductMetric>('pesos')
  const [all, setAll] = useState(false)

  return (
    <section aria-label="Productos del mes">
      <MonthlyProductList
        products={results.products}
        sort={sort}
        metric={metric}
        all={all}
        onSort={(next) => {
          setSort(next)
          setAll(false)
        }}
        onMetric={setMetric}
        onAll={setAll}
      />
    </section>
  )
}
