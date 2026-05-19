import { useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import { useChapanClientsList } from '@/entities/order/queries';
import { formatPhoneNumber, formatDistanceToNow } from '../../../../shared/lib/formatting';
import styles from './ChapanClients.module.css';

const SORT_OPTIONS = [
  { value: 'lastOrder', label: 'Последние' },
  { value: 'name', label: 'По имени' },
  { value: 'orders', label: 'По заказам' },
  { value: 'spent', label: 'По сумме' },
] as const;

const CUSTOMER_TYPE_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'retail', label: 'Розница' },
  { value: 'wholesale', label: 'Опт' },
] as const;

export default function ChapanClients() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') ?? '';
  const customerType = (searchParams.get('customerType') ?? 'all') as 'all' | 'retail' | 'wholesale';
  const sortBy = (searchParams.get('sortBy') ?? 'lastOrder') as 'name' | 'orders' | 'spent' | 'lastOrder';
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);
  const limit = 50;

  const { data, isLoading } = useChapanClientsList({
    search: search || undefined,
    customerType,
    sortBy,
    limit,
    offset,
  });

  const handleSearchChange = useCallback(
    (newSearch: string) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        if (newSearch) {
          p.set('search', newSearch);
        } else {
          p.delete('search');
        }
        p.set('offset', '0');
        return p;
      });
    },
    [setSearchParams]
  );

  const handleCustomerTypeChange = useCallback(
    (type: typeof customerType) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set('customerType', type);
        p.set('offset', '0');
        return p;
      });
    },
    [setSearchParams]
  );

  const handleSortChange = useCallback(
    (sort: typeof sortBy) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set('sortBy', sort);
        p.set('offset', '0');
        return p;
      });
    },
    [setSearchParams]
  );

  const handleClientClick = useCallback(
    (id: string) => {
      navigate(`/workzone/chapan/clients/${id}`);
    },
    [navigate]
  );

  const hasRetail = useMemo(() => {
    if (!data?.results) return false;
    return data.results.some((c) => c.retailOrderCount > 0);
  }, [data?.results]);

  const hasWholesale = useMemo(() => {
    if (!data?.results) return false;
    return data.results.some((c) => c.wholesaleOrderCount > 0);
  }, [data?.results]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Клиенты</h1>
        {data && <span className={styles.count}>{data.count}</span>}
      </div>

      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Поиск по имени, телефону, компании..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <select
          value={sortBy}
          onChange={(e) => handleSortChange(e.target.value as typeof sortBy)}
          className={styles.sortSelect}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.tabs}>
        {CUSTOMER_TYPE_OPTIONS.map((opt) => {
          const isVisible = opt.value === 'all' || (opt.value === 'retail' && hasRetail) || (opt.value === 'wholesale' && hasWholesale);
          if (!isVisible) return null;
          return (
            <button
              key={opt.value}
              className={`${styles.tab} ${customerType === opt.value ? styles.tabActive : ''}`}
              onClick={() => handleCustomerTypeChange(opt.value)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className={styles.list}>
        {isLoading ? (
          <div className={styles.loading}>Загрузка...</div>
        ) : !data?.results || data.results.length === 0 ? (
          <div className={styles.empty}>
            <p>Клиентов пока нет</p>
          </div>
        ) : (
          data.results.map((client) => (
            <button
              key={client.id}
              className={styles.clientRow}
              onClick={() => handleClientClick(client.id)}
            >
              <div className={styles.avatar}>{client.fullName[0]?.toUpperCase() || '?'}</div>

              <div className={styles.mainInfo}>
                <div className={styles.name}>{client.fullName}</div>
                <div className={styles.secondary}>
                  {client.phone && <span>{formatPhoneNumber(client.phone)}</span>}
                  {client.company && <span>{client.company}</span>}
                </div>
              </div>

              <div className={styles.badges}>
                {client.retailOrderCount > 0 && <span className={styles.badgeRetail}>Розница</span>}
                {client.wholesaleOrderCount > 0 && <span className={styles.badgeWholesale}>Опт</span>}
              </div>

              <div className={styles.stats}>
                <span className={styles.stat}>{client.orderCount} заказ{getPlural(client.orderCount)}</span>
                <span className={styles.stat}>
                  {formatAmount(client.totalSpent)} ₸
                </span>
                {client.lastOrderAt && (
                  <span className={styles.statDate}>{formatDistanceToNow(new Date(client.lastOrderAt))}</span>
                )}
              </div>

              <ChevronRight size={20} className={styles.chevron} />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function getPlural(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return '';
  return 'ов';
}

function formatAmount(amount: number): string {
  if (amount >= 1_000_000) {
    return (amount / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' млн';
  }
  if (amount >= 1_000) {
    return (amount / 1_000).toFixed(0) + ' тыс';
  }
  return amount.toString();
}
