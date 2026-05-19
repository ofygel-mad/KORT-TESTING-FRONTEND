import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, PackageSearch, RefreshCw } from 'lucide-react';
import { useKaspiOrders } from '@/entities/kaspi/queries';
import type { KaspiOrder } from '@/entities/kaspi/types';
import {
  buildKaspiIssueLabel,
  formatKaspiDateTime,
  formatKaspiMoney,
  getKaspiStatusTone,
  getKaspiStockTone,
  KASPI_STAGE_META,
  matchesKaspiSearch,
  matchesKaspiStage,
  type KaspiStageKey,
} from './kaspi-view-model';
import styles from './ChapanKaspiOrders.module.css';

type StagePageProps = {
  stage: Exclude<KaspiStageKey, 'stock'>;
};

function statusToneClass(tone: ReturnType<typeof getKaspiStatusTone>) {
  if (tone === 'good') return styles.statusGood;
  if (tone === 'warn') return styles.statusWarn;
  if (tone === 'bad') return styles.statusBad;
  if (tone === 'info') return styles.statusInfo;
  return styles.statusDefault;
}

function stockToneClass(tone: ReturnType<typeof getKaspiStockTone>) {
  if (tone === 'good') return styles.statusGood;
  if (tone === 'warn') return styles.statusWarn;
  if (tone === 'bad') return styles.statusBad;
  return styles.statusDefault;
}

function renderIssueColumn(order: KaspiOrder, stage: Exclude<KaspiStageKey, 'stock'>) {
  if (stage !== 'issues') {
    return (
      <div className={styles.stack}>
        <span>{formatKaspiDateTime(order.lastExternalUpdateAt)}</span>
        <span className={styles.metaLabel}>{order.syncError || '\u2014'}</span>
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      <span>{buildKaspiIssueLabel(order)}</span>
      <span className={styles.metaLabel}>{order.syncError || order.stockImpactState}</span>
    </div>
  );
}

export default function ChapanKaspiStagePage({ stage }: StagePageProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data: ordersData, isLoading, isError } = useKaspiOrders({ limit: 500, offset: 0 });

  const stageMeta = KASPI_STAGE_META.find((item) => item.key === stage)!;
  const filteredOrders = useMemo(() => {
    return (ordersData?.results ?? []).filter((order) => matchesKaspiStage(order, stage) && matchesKaspiSearch(order, search));
  }, [ordersData?.results, search, stage]);

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.panelTitle}>{stageMeta.label}</div>
          <div className={styles.panelSub}>{stageMeta.description}</div>
        </div>
        <div className={styles.inlineStats}>
          <span className={styles.inlineStatLabel}>{'\u0412 \u0432\u0438\u0434\u0435'}</span>
          <strong>{filteredOrders.length}</strong>
        </div>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Order code / customer / sku"
        />
        <div className={styles.toolbarNote}>
          <Activity size={14} />
          <span>{'\u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u0441\u0442\u0440\u043e\u043a\u0443 \u0434\u043b\u044f detail, history \u0438 sync diagnostics.'}</span>
        </div>
      </div>

      {isLoading && (
        <div className={styles.empty}>
          <RefreshCw size={22} />
          <div>{'\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 Kaspi \u0437\u0430\u043a\u0430\u0437\u043e\u0432...'}</div>
        </div>
      )}

      {isError && (
        <div className={styles.empty}>
          <PackageSearch size={22} />
          <div>{'\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c Kaspi \u0437\u0430\u043a\u0430\u0437\u044b.'}</div>
        </div>
      )}

      {!isLoading && !isError && filteredOrders.length === 0 && (
        <div className={styles.empty}>
          <PackageSearch size={22} />
          <div>{'\u041f\u043e \u0442\u0435\u043a\u0443\u0449\u0438\u043c \u0444\u0438\u043b\u044c\u0442\u0440\u0430\u043c \u043d\u0435\u0442 Kaspi \u0437\u0430\u043a\u0430\u0437\u043e\u0432.'}</div>
        </div>
      )}

      {!isLoading && !isError && filteredOrders.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{'\u0417\u0430\u043a\u0430\u0437'}</th>
                <th>{'\u041a\u043b\u0438\u0435\u043d\u0442'}</th>
                <th>{'\u0421\u0442\u0430\u0442\u0443\u0441 Kaspi'}</th>
                <th>{'\u0421\u043a\u043b\u0430\u0434 / match'}</th>
                <th>{'\u0421\u0443\u043c\u043c\u0430'}</th>
                <th>{stage === 'issues' ? '\u041f\u0440\u043e\u0431\u043b\u0435\u043c\u0430' : '\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr
                  key={order.externalOrderId}
                  className={styles.rowButton}
                  onClick={() => navigate(`/workzone/chapan/kaspi-orders/${order.externalOrderId}`)}
                >
                  <td>
                    <div className={styles.stack}>
                      <strong>{order.externalOrderCode || order.externalOrderId}</strong>
                      <span className={`${styles.metaLabel} ${styles.mono}`}>{order.externalOrderId}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.stack}>
                      <strong>{order.customerName || '\u2014'}</strong>
                      <span className={styles.metaLabel}>{order.customerPhone || '\u2014'}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.badgeRow}>
                      <span className={`${styles.badge} ${statusToneClass(getKaspiStatusTone(order))}`}>
                        {order.externalStatus || '\u2014'}
                      </span>
                      <span className={`${styles.badge} ${styles.statusDefault}`}>
                        {order.externalState || '\u2014'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.badgeRow}>
                      <span className={`${styles.badge} ${order.matchState === 'matched' ? styles.statusGood : styles.statusWarn}`}>
                        {order.matchState}
                      </span>
                      <span className={`${styles.badge} ${stockToneClass(getKaspiStockTone(order))}`}>
                        {order.stockImpactState}
                      </span>
                    </div>
                  </td>
                  <td>{formatKaspiMoney(order.totalPrice)}</td>
                  <td>{renderIssueColumn(order, stage === 'issues' ? 'issues' : stage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
