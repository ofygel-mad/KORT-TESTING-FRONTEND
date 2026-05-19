import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Store } from 'lucide-react';
import { useKaspiOrder } from '@/entities/kaspi/queries';
import type { KaspiOrderDetail } from '@/entities/kaspi/types';
import styles from './ChapanKaspiOrders.module.css';

const MONEY = new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 });

function fmtMoney(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }
  return `${MONEY.format(value)} ₸`;
}

function fmtDateTime(value: string | null) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString('ru-KZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function stringifySnapshot(snapshot: Record<string, unknown> | null) {
  if (!snapshot) {
    return null;
  }
  return JSON.stringify(snapshot, null, 2);
}

function DetailMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metaCard}>
      <div className={styles.metaLabel}>{label}</div>
      <div className={styles.metaValue}>{value}</div>
    </div>
  );
}

function ItemsTable({ order }: { order: KaspiOrderDetail }) {
  const rows = [...order.matchedItems, ...order.unmatchedItems].sort((a, b) => {
    const left = a.entryNumber ?? 0;
    const right = b.entryNumber ?? 0;
    return left - right;
  });

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{'\u041f\u043e\u0437\u0438\u0446\u0438\u044f'}</th>
            <th>SKU</th>
            <th>{'\u041a\u043e\u043b-\u0432\u043e / \u0441\u0443\u043c\u043c\u0430'}</th>
            <th>Match</th>
            <th>Stock</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.externalEntryId}>
              <td>
                <div className={styles.stack}>
                  <strong>{item.productName || '—'}</strong>
                  <span className={styles.metaLabel}>{item.manufacturer || item.categoryTitle || '—'}</span>
                </div>
              </td>
              <td>
                <div className={styles.stack}>
                  <span className={styles.mono}>{item.merchantSku || '—'}</span>
                  <span className={styles.metaLabel}>{item.warehouseSku || '—'}</span>
                </div>
              </td>
              <td>
                <div className={styles.stack}>
                  <span>{item.quantity ?? '—'}</span>
                  <span className={styles.metaLabel}>{fmtMoney(item.totalPrice)}</span>
                </div>
              </td>
              <td>
                <div className={styles.stack}>
                  <span>{item.matchState}</span>
                  <span className={styles.metaLabel}>{item.matchReason || '—'}</span>
                </div>
              </td>
              <td>
                <div className={styles.stack}>
                  <span>{item.stockImpactState}</span>
                  <span className={styles.metaLabel}>{item.reservationStatus || '—'}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ChapanKaspiOrderDetailPage() {
  const navigate = useNavigate();
  const { externalOrderId } = useParams<{ externalOrderId: string }>();
  const { data: order, isLoading, isError } = useKaspiOrder(externalOrderId);

  const customerJson = useMemo(() => stringifySnapshot(order?.customerSnapshot ?? null), [order?.customerSnapshot]);
  const deliveryJson = useMemo(() => stringifySnapshot(order?.deliverySnapshot ?? null), [order?.deliverySnapshot]);

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <RefreshCw size={22} />
          <div>{'\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 Kaspi \u0437\u0430\u043a\u0430\u0437\u0430...'}</div>
        </div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <Store size={22} />
          <div>{'\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043a\u0440\u044b\u0442\u044c Kaspi \u0437\u0430\u043a\u0430\u0437.'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleWrap}>
          <button type="button" className={styles.button} onClick={() => navigate(-1)}>
            <ArrowLeft size={14} />
            <span>{'\u041d\u0430\u0437\u0430\u0434'}</span>
          </button>
          <div className={styles.title}>
            <Store size={20} />
            <span>{order.externalOrderCode || order.externalOrderId}</span>
          </div>
          <div className={styles.subtitle}>
            {order.customerName || '—'} · {order.externalStatus || '—'} / {order.externalState || '—'}
          </div>
        </div>
      </header>

      <div className={styles.detailGrid}>
        <div className={styles.detailColumn}>
          <section className={styles.panel}>
            <div className={styles.panelTitle}>{'\u041e\u0441\u043d\u043e\u0432\u043d\u0430\u044f \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u044f'}</div>
            <div className={styles.metaGrid}>
              <DetailMeta label={'Kaspi order ID'} value={order.externalOrderId} />
              <DetailMeta label={'Kaspi code'} value={order.externalOrderCode || '—'} />
              <DetailMeta label={'Delivery mode'} value={order.deliveryMode || '—'} />
              <DetailMeta label={'Payment mode'} value={order.paymentMode || '—'} />
              <DetailMeta label={'\u0421\u0443\u043c\u043c\u0430'} value={fmtMoney(order.totalPrice)} />
              <DetailMeta label={'\u041f\u043b\u0430\u043d. \u0434\u0430\u0442\u0430'} value={fmtDateTime(order.plannedDeliveryDate)} />
              <DetailMeta label={'\u0421\u043e\u0437\u0434\u0430\u043d'} value={fmtDateTime(order.creationDate)} />
              <DetailMeta label={'\u041e\u0431\u043d\u043e\u0432\u043b\u0451\u043d \u0432 Kaspi'} value={fmtDateTime(order.lastExternalUpdateAt)} />
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}>{'\u0422\u043e\u0432\u0430\u0440\u044b \u0438 match state'}</div>
            <ItemsTable order={order} />
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}>{'\u0421\u043d\u0438\u043c\u043e\u043a \u0434\u0430\u043d\u043d\u044b\u0445 \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u0438 delivery'}</div>
            <div className={styles.detailGrid}>
              <div className={styles.detailColumn}>
                <div className={styles.sectionTitle}>{'\u041a\u043b\u0438\u0435\u043d\u0442'}</div>
                {customerJson ? <pre className={styles.jsonBox}>{customerJson}</pre> : <div className={styles.metaLabel}>—</div>}
              </div>
              <div className={styles.detailColumn}>
                <div className={styles.sectionTitle}>Delivery</div>
                {deliveryJson ? <pre className={styles.jsonBox}>{deliveryJson}</pre> : <div className={styles.metaLabel}>—</div>}
              </div>
            </div>
          </section>
        </div>

        <div className={styles.detailColumn}>
          <section className={styles.panel}>
            <div className={styles.panelTitle}>{'\u0421\u0442\u0430\u0442\u0443\u0441 \u0438 stock tracking'}</div>
            <div className={styles.simpleList}>
              <div className={styles.listRow}>
                <span className={styles.metaLabel}>{'Kaspi status'}</span>
                <strong>{order.externalStatus || '—'}</strong>
              </div>
              <div className={styles.listRow}>
                <span className={styles.metaLabel}>{'Kaspi state'}</span>
                <strong>{order.externalState || '—'}</strong>
              </div>
              <div className={styles.listRow}>
                <span className={styles.metaLabel}>{'Match state'}</span>
                <strong>{order.matchState}</strong>
              </div>
              <div className={styles.listRow}>
                <span className={styles.metaLabel}>{'Stock impact'}</span>
                <strong>{order.stockImpactState}</strong>
              </div>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}>{'\u0421\u043d\u0438\u043c\u043e\u043a history'}</div>
            <div className={styles.simpleList}>
              {order.statusHistory.map((item) => (
                <div key={item.key} className={styles.listRow}>
                  <span className={styles.metaLabel}>{item.label}</span>
                  <strong>{fmtDateTime(item.at)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}>{'\u0421\u0432\u044f\u0437\u0438 \u0438 sync diagnostics'}</div>
            <div className={styles.simpleList}>
              <div className={styles.listRow}>
                <span className={styles.metaLabel}>{'\u0412\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0439 order'}</span>
                <strong>{order.internalOrderId || '—'}</strong>
              </div>
              <div className={styles.listRow}>
                <span className={styles.metaLabel}>{'\u0422\u0438\u043f \u0441\u0432\u044f\u0437\u0438'}</span>
                <strong>{order.internalOrderType || '—'}</strong>
              </div>
              <div className={styles.listRow}>
                <span className={styles.metaLabel}>{'\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 sync'}</span>
                <strong>{fmtDateTime(order.syncDiagnostics.lastSyncedAt)}</strong>
              </div>
              <div className={styles.listRow}>
                <span className={styles.metaLabel}>{'Raw payload'}</span>
                <strong>{order.syncDiagnostics.rawPayloadPresent ? 'yes' : 'no'}</strong>
              </div>
              <div className={styles.listRow}>
                <span className={styles.metaLabel}>{'\u041e\u0448\u0438\u0431\u043a\u0430 sync'}</span>
                <strong>{order.syncDiagnostics.syncError || '—'}</strong>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
