import React, { useMemo, useState } from 'react';
import { useWarehouseItems } from '../../../../entities/warehouse/queries';
import type { WarehouseItem } from '../../../../entities/warehouse/types';
import { getStockStatus } from '../../../../entities/warehouse/types';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { EmptyState } from '../../../../shared/ui/EmptyState';
import { StatusChip } from '../../../../shared/ui/StatusChip';
import { Package, ChevronLeft, ChevronRight } from 'lucide-react';
import { filterItemsByStatus } from './warehouseGrouping';
import styles from './WarehouseSkuTable.module.css';

type StatusFilter = 'all' | 'instock' | 'reserved' | 'empty';

interface WarehouseSkuTableProps {
  search: string;
  statusFilter: StatusFilter;
  onSelectItem: (itemId: string) => void;
}

const ITEMS_PER_PAGE = 25;

export const WarehouseSkuTable: React.FC<WarehouseSkuTableProps> = ({
  search,
  statusFilter,
  onSelectItem,
}) => {
  const { data: items, isLoading } = useWarehouseItems({
    search: search || undefined,
  });

  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!items) return [];
    return filterItemsByStatus(items, statusFilter);
  }, [items, statusFilter]);

  const paginatedItems = useMemo(() => {
    const start = page * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, page]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.table}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={styles.rowSkeleton}>
              <Skeleton width="80%" height={16} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className={styles.container}>
        <EmptyState
          title="Нет товаров"
          description="Попробуйте изменить фильтры или выполнить поиск"
          icon={Package}
        />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th className={styles.thCol}>Название</th>
              <th className={styles.thCol}>SKU</th>
              <th className={styles.thCol}>Катег.</th>
              <th className={styles.thCol}>В нал.</th>
              <th className={styles.thCol}>Зарез</th>
              <th className={styles.thCol}>Доступно</th>
              <th className={styles.thCol}>Мин</th>
              <th className={styles.thCol}>Статус</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map(item => {
              const available = item.qty - item.qtyReserved;
              const status = getStockStatus(item);
              return (
                <tr
                  key={item.id}
                  className={styles.row}
                  onClick={() => onSelectItem(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectItem(item.id);
                    }
                  }}
                  tabIndex={0}
                >
                  <td className={styles.col}>
                    <div className={styles.nameCell}>{item.name}</div>
                  </td>
                  <td className={styles.col}>
                    <code className={styles.mono}>{item.sku || '—'}</code>
                  </td>
                  <td className={styles.col}>{item.category?.name || '—'}</td>
                  <td className={`${styles.col} ${styles.numeric}`}>{item.qty}</td>
                  <td className={`${styles.col} ${styles.numeric}`}>{item.qtyReserved}</td>
                  <td className={`${styles.col} ${styles.numeric}`}>{available}</td>
                  <td className={`${styles.col} ${styles.numeric}`}>{item.qtyMin}</td>
                  <td className={styles.col}>
                    <StatusChip status={status} size="sm" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
          >
            <ChevronLeft size={16} />
            Пред
          </button>

          <div className={styles.pageInfo}>
            Стр. {page + 1} из {totalPages}
          </div>

          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
          >
            След
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
