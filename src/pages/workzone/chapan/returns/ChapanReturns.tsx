import { useNavigate } from 'react-router-dom';
import { useReturns } from '../../../../entities/order/queries';
import type { ReturnReason } from '../../../../entities/order/types';
import { RETURN_REASON_LABELS } from '../../../../entities/order/types';
import styles from './ChapanReturns.module.css';

function fmt(n: number) {
  return `${new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n)} ₸`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'short' });
}

export default function ChapanReturnsPage() {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useReturns({});
  const allReturns = data?.results ?? [];
  const confirmed = allReturns.filter((r) => r.status === 'confirmed');

  if (isLoading) {
    return (
      <div className={styles.root}>
        <div className={styles.loadingState}>Загрузка...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.root}>
        <div className={styles.errorState}>Не удалось загрузить возвраты</div>
      </div>
    );
  }

  // Compute stats from confirmed returns only
  const totalCount = confirmed.length;
  const totalAmount = confirmed.reduce((s, r) => s + r.totalRefundAmount, 0);

  const byReason = confirmed.reduce(
    (acc, r) => {
      const key = r.reason;
      if (!acc[key]) {
        acc[key] = { count: 0, amount: 0 };
      }
      acc[key].count += 1;
      acc[key].amount += r.totalRefundAmount;
      return acc;
    },
    {} as Record<ReturnReason, { count: number; amount: number }>
  );

  const reasonsSorted = (Object.entries(byReason) as [ReturnReason, { count: number; amount: number }][])
    .sort((a, b) => b[1].count - a[1].count);

  const topReason = reasonsSorted[0]?.[0];

  // Top returned products
  const byProduct: Record<string, { name: string; count: number; amount: number }> = {};
  confirmed.forEach((ret) => {
    ret.items.forEach((item) => {
      const key = `${item.productName}/${item.size}`;
      if (!byProduct[key]) {
        byProduct[key] = { name: `${item.productName} / ${item.size}`, count: 0, amount: 0 };
      }
      byProduct[key].count += item.qty;
      byProduct[key].amount += item.refundAmount;
    });
  });

  const productsSorted = Object.values(byProduct).sort((a, b) => b.count - a.count).slice(0, 5);

  // Recent returns
  const recent = [...confirmed].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Возвраты</h1>
      </div>

      <div className={styles.summaryCards}>
        <div className={styles.card}>
          <div className={styles.cardValue}>{totalCount}</div>
          <div className={styles.cardLabel}>возвратов</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardValue}>{fmt(totalAmount)}</div>
          <div className={styles.cardLabel}>возвращено</div>
        </div>
        {topReason && (
          <div className={styles.card}>
            <div className={styles.cardValue}>{RETURN_REASON_LABELS[topReason]}</div>
            <div className={styles.cardLabel}>ТОП причина</div>
          </div>
        )}
      </div>

      <div className={styles.grid}>
        <div className={styles.tableSection}>
          <div className={styles.sectionTitle}>По причинам</div>
          {reasonsSorted.length === 0 ? (
            <div className={styles.emptyState}>Нет данных</div>
          ) : (
            <table className={styles.table}>
              <tbody>
                {reasonsSorted.map(([reason, stats]) => (
                  <tr key={reason} className={styles.tableRow}>
                    <td className={styles.tableCell}>{RETURN_REASON_LABELS[reason]}</td>
                    <td className={`${styles.tableCell} ${styles.tableRight}`}>
                      {stats.count}
                    </td>
                    <td className={`${styles.tableCell} ${styles.tableRightAmount}`}>
                      {fmt(stats.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={styles.tableSection}>
          <div className={styles.sectionTitle}>Последние возвраты</div>
          {recent.length === 0 ? (
            <div className={styles.emptyState}>Нет возвратов</div>
          ) : (
            <div className={styles.recentList}>
              {recent.map((ret) => (
                <button
                  key={ret.id}
                  type="button"
                  className={styles.recentItem}
                  onClick={() => navigate(`/workzone/chapan/orders/${ret.orderId}`)}
                >
                  <div className={styles.recentItemLeft}>
                    <span className={styles.recentNum}>{ret.returnNumber}</span>
                    <span className={styles.recentClient}>{ret.order.clientName}</span>
                  </div>
                  <div className={styles.recentItemRight}>
                    <span className={styles.recentReason}>{RETURN_REASON_LABELS[ret.reason]}</span>
                    <span className={styles.recentAmount}>−{fmt(ret.totalRefundAmount)}</span>
                  </div>
                  <span className={styles.recentDate}>{fmtDate(ret.createdAt)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {productsSorted.length > 0 && (
        <div className={styles.tableSection}>
          <div className={styles.sectionTitle}>Топ возвращаемые товары</div>
          <table className={styles.table}>
            <tbody>
              {productsSorted.map((product) => (
                <tr key={product.name} className={styles.tableRow}>
                  <td className={styles.tableCell}>{product.name}</td>
                  <td className={`${styles.tableCell} ${styles.tableRight}`}>
                    {product.count} шт.
                  </td>
                  <td className={`${styles.tableCell} ${styles.tableRightAmount}`}>
                    {fmt(product.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
