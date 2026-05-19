import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, PackageSearch, RefreshCw } from 'lucide-react';
import { useKaspiOrders } from '@/entities/kaspi/queries';
import {
  buildKaspiStockRows,
  formatKaspiDateTime,
  formatKaspiMoney,
  matchesKaspiStockRow,
} from './kaspi-view-model';
import styles from './ChapanKaspiOrders.module.css';

type StockFilterKey = 'all' | 'attention' | 'matched' | 'reserved';

const STOCK_FILTERS: Array<{ key: StockFilterKey; label: string }> = [
  { key: 'all', label: '\u0412\u0441\u0435 \u043f\u043e\u0437\u0438\u0446\u0438\u0438' },
  { key: 'attention', label: '\u0422\u0440\u0435\u0431\u0443\u044e\u0442 \u0432\u043d\u0438\u043c\u0430\u043d\u0438\u044f' },
  { key: 'matched', label: '\u0421\u043e match' },
  { key: 'reserved', label: '\u0421 reserve / consume' },
];

function matchesStockFilter(
  key: StockFilterKey,
  row: ReturnType<typeof buildKaspiStockRows>[number],
) {
  if (key === 'all') {
    return true;
  }
  if (key === 'attention') {
    return row.item.matchState !== 'matched'
      || !['reserved', 'released', 'pending_acceptance', 'not_tracked'].includes(row.item.stockImpactState)
      || !!row.item.matchReason;
  }
  if (key === 'matched') {
    return row.item.matchState === 'matched';
  }
  return row.item.reservationStatus === 'active' || row.item.reservationStatus === 'consumed';
}

export default function ChapanKaspiStockPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StockFilterKey>('attention');
  const { data: ordersData, isLoading, isError } = useKaspiOrders({ limit: 500, offset: 0 });

  const rows = useMemo(() => {
    return buildKaspiStockRows(ordersData?.results ?? [])
      .filter((row) => matchesStockFilter(filter, row) && matchesKaspiStockRow(row, search));
  }, [filter, ordersData?.results, search]);

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.panelTitle}>{'\u0421\u043a\u043b\u0430\u0434 Kaspi'}</div>
          <div className={styles.panelSub}>
            {'\u041e\u0442\u0434\u0435\u043b\u044c\u043d\u044b\u0439 \u0440\u0435\u0435\u0441\u0442\u0440 SKU, match \u0438 reservations \u0434\u043b\u044f Kaspi \u0431\u0435\u0437 \u0432\u043c\u0435\u0448\u0430\u0442\u0435\u043b\u044c\u0441\u0442\u0432\u0430 \u0432 Chapan warehouse UI.'}
          </div>
        </div>
        <div className={styles.inlineStats}>
          <span className={styles.inlineStatLabel}>{'\u0421\u0442\u0440\u043e\u043a'}</span>
          <strong>{rows.length}</strong>
        </div>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="SKU / product / order / customer"
        />
        <div className={styles.presetRow}>
          {STOCK_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`${styles.chip} ${filter === item.key ? styles.chipActive : ''}`}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.toolbarNote}>
        <Activity size={14} />
        <span>{'\u0415\u0441\u043b\u0438 merchant SKU \u043d\u0435 \u0441\u043e\u0432\u043f\u0430\u0434\u0430\u0435\u0442 \u0441 warehouse SKU, \u043f\u043e\u0437\u0438\u0446\u0438\u044f \u043e\u0441\u0442\u0430\u0451\u0442\u0441\u044f \u0437\u0434\u0435\u0441\u044c \u043a\u0430\u043a unmatched.'}</span>
      </div>

      {isLoading && (
        <div className={styles.empty}>
          <RefreshCw size={22} />
          <div>{'\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 Kaspi stock registry...'}</div>
        </div>
      )}

      {isError && (
        <div className={styles.empty}>
          <PackageSearch size={22} />
          <div>{'\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c Kaspi stock registry.'}</div>
        </div>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <div className={styles.empty}>
          <PackageSearch size={22} />
          <div>{'\u041f\u043e \u0442\u0435\u043a\u0443\u0449\u0438\u043c \u0444\u0438\u043b\u044c\u0442\u0440\u0430\u043c \u043d\u0435\u0442 \u043f\u043e\u0437\u0438\u0446\u0438\u0439.'}</div>
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{'\u0417\u0430\u043a\u0430\u0437'}</th>
                <th>{'\u0422\u043e\u0432\u0430\u0440'}</th>
                <th>{'SKU'}</th>
                <th>{'\u041a\u043e\u043b-\u0432\u043e / \u0441\u0443\u043c\u043c\u0430'}</th>
                <th>{'Match / stock'}</th>
                <th>{'\u0420\u0435\u0437\u0435\u0440\u0432 / status'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.orderId}:${row.item.externalEntryId}`}
                  className={styles.rowButton}
                  onClick={() => navigate(`/workzone/chapan/kaspi-orders/${row.orderId}`)}
                >
                  <td>
                    <div className={styles.stack}>
                      <strong>{row.orderCode || row.orderId}</strong>
                      <span className={styles.metaLabel}>{row.customerName || row.customerPhone || '\u2014'}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.stack}>
                      <strong>{row.item.productName || '\u2014'}</strong>
                      <span className={styles.metaLabel}>{row.item.manufacturer || row.item.categoryTitle || '\u2014'}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.mono}>{row.item.merchantSku || '\u2014'}</span>
                      <span className={styles.metaLabel}>{row.item.warehouseSku || '\u2014'}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.stack}>
                      <span>{row.item.quantity ?? '\u2014'}</span>
                      <span className={styles.metaLabel}>{formatKaspiMoney(row.item.totalPrice)}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.stack}>
                      <span>{row.item.matchState}</span>
                      <span className={styles.metaLabel}>{row.item.matchReason || row.item.stockImpactState}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.stack}>
                      <span>{row.item.reservationStatus || '\u2014'}</span>
                      <span className={styles.metaLabel}>
                        {row.externalStatus || '\u2014'} / {formatKaspiDateTime(row.lastExternalUpdateAt)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
