import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useWarehouseItems } from '@/entities/warehouse/queries';
import { getQtyAvailable, type WarehouseItem } from '@/entities/warehouse/types';
import { EmptyState } from '../../../../shared/ui/EmptyState';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { StatusChip, type ChipStatus } from '../../../../shared/ui/StatusChip';
import { filterItemsByStatus } from './warehouseGrouping';
import styles from './WarehouseSkuTable.module.css';

type StatusFilter = 'all' | 'instock' | 'reserved' | 'empty';

interface WarehouseSkuTableProps {
  search: string;
  statusFilter: StatusFilter;
  onSelectItem: (itemId: string) => void;
  verificationRequired?: boolean;
}

interface SkuStatusPresentation {
  status: ChipStatus;
  label: string;
}

const ITEMS_PER_PAGE = 25;
const EM_DASH = '\u2014';
const LABEL_RESERVE = '\u0420\u0435\u0437\u0435\u0440\u0432';
const LABEL_EMPTY = '\u041d\u0435\u0442';
const LABEL_IN_STOCK = '\u0412 \u043d\u0430\u043b\u0438\u0447\u0438\u0438';
const EMPTY_TITLE = '\u041d\u0435\u0442 \u0442\u043e\u0432\u0430\u0440\u043e\u0432';
const EMPTY_DESCRIPTION = '\u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0438\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0444\u0438\u043b\u044c\u0442\u0440\u044b \u0438\u043b\u0438 \u0432\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u043f\u043e\u0438\u0441\u043a.';
const HEADING_PRODUCT = '\u0422\u043e\u0432\u0430\u0440';
const HEADING_COLOR = '\u0426\u0432\u0435\u0442';
const HEADING_GENDER = '\u041f\u043e\u043b';
const HEADING_SIZE = '\u0420\u0430\u0437\u043c\u0435\u0440';
const HEADING_LENGTH = '\u0414\u043b\u0438\u043d\u0430';
const GENDER_LABEL_MALE = '\u041c\u0443\u0436\u0441\u043a\u043e\u0439';
const GENDER_LABEL_FEMALE = '\u0416\u0435\u043d\u0441\u043a\u0438\u0439';
const HEADING_ON_HAND = '\u0412 \u043d\u0430\u043b\u0438\u0447\u0438\u0438';
const HEADING_RESERVED = '\u0420\u0435\u0437\u0435\u0440\u0432';
const HEADING_AVAILABLE = '\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u043e';
const HEADING_STATUS = '\u0421\u0442\u0430\u0442\u0443\u0441';
const PAGINATION_PREV = '\u041f\u0440\u0435\u0434.';
const PAGINATION_NEXT = '\u0421\u043b\u0435\u0434.';
const PAGINATION_PAGE = '\u0421\u0442\u0440.';
const PAGINATION_OF = '\u0438\u0437';

const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });

const getAttributeValue = (item: WarehouseItem, key: 'color' | 'size' | 'length' | 'gender'): string =>
  item.attributesJson?.[key]?.trim() || EM_DASH;

const formatGenderLabel = (raw: string): string => {
  const value = raw.trim().toLowerCase();
  if (value === 'male' || value === 'муж' || value === 'мужской') return GENDER_LABEL_MALE;
  if (value === 'female' || value === 'жен' || value === 'женский') return GENDER_LABEL_FEMALE;
  return raw || EM_DASH;
};

const getSkuStatusPresentation = (item: WarehouseItem): SkuStatusPresentation => {
  const available = getQtyAvailable(item);

  if (available === 0 && item.qtyReserved > 0) {
    return { status: 'warn', label: LABEL_RESERVE };
  }

  if (available === 0) {
    return { status: 'err', label: LABEL_EMPTY };
  }

  return { status: 'ok', label: LABEL_IN_STOCK };
};

const sortSkuItems = (items: WarehouseItem[]) =>
  [...items].sort((left, right) => {
    const nameCompare = collator.compare(left.name, right.name);
    if (nameCompare !== 0) return nameCompare;

    const colorCompare = collator.compare(getAttributeValue(left, 'color'), getAttributeValue(right, 'color'));
    if (colorCompare !== 0) return colorCompare;

    const genderCompare = collator.compare(getAttributeValue(left, 'gender'), getAttributeValue(right, 'gender'));
    if (genderCompare !== 0) return genderCompare;

    const sizeCompare = collator.compare(getAttributeValue(left, 'size'), getAttributeValue(right, 'size'));
    if (sizeCompare !== 0) return sizeCompare;

    const lengthCompare = collator.compare(getAttributeValue(left, 'length'), getAttributeValue(right, 'length'));
    if (lengthCompare !== 0) return lengthCompare;

    return collator.compare(left.id, right.id);
  });

export const WarehouseSkuTable: React.FC<WarehouseSkuTableProps> = ({
  search,
  statusFilter,
  onSelectItem,
  verificationRequired,
}) => {
  const { data: items, isLoading } = useWarehouseItems({
    search: search || undefined,
    verificationRequired,
  });

  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const itemsArray = items?.results || [];
    return sortSkuItems(filterItemsByStatus(itemsArray, statusFilter));
  }, [items, statusFilter]);

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    setPage((currentPage) => Math.min(currentPage, totalPages - 1));
  }, [filtered.length]);

  const paginatedItems = useMemo(() => {
    const start = page * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, page]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.tableWrapper}>
          <div className={styles.table}>
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className={styles.rowSkeleton}>
                <Skeleton width="80%" height={16} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className={styles.container}>
        <EmptyState title={EMPTY_TITLE} description={EMPTY_DESCRIPTION} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th className={styles.thCol}>{HEADING_PRODUCT}</th>
              <th className={styles.thCol}>{HEADING_COLOR}</th>
              <th className={styles.thCol}>{HEADING_GENDER}</th>
              <th className={styles.thCol}>{HEADING_SIZE}</th>
              <th className={styles.thCol}>{HEADING_LENGTH}</th>
              <th className={`${styles.thCol} ${styles.thNumeric}`}>{HEADING_ON_HAND}</th>
              <th className={`${styles.thCol} ${styles.thNumeric}`}>{HEADING_RESERVED}</th>
              <th className={`${styles.thCol} ${styles.thNumeric}`}>{HEADING_AVAILABLE}</th>
              <th className={styles.thCol}>{HEADING_STATUS}</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((item) => {
              const color = getAttributeValue(item, 'color');
              const genderRaw = getAttributeValue(item, 'gender');
              const gender = genderRaw === EM_DASH ? EM_DASH : formatGenderLabel(genderRaw);
              const size = getAttributeValue(item, 'size');
              const length = getAttributeValue(item, 'length');
              const available = getQtyAvailable(item);
              const chip = getSkuStatusPresentation(item);

              return (
                <tr
                  key={item.id}
                  className={styles.row}
                  onClick={() => onSelectItem(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectItem(item.id);
                    }
                  }}
                  tabIndex={0}
                >
                  <td className={`${styles.col} ${styles.nameCol}`}>{item.name}</td>
                  <td className={styles.col}>{color}</td>
                  <td className={styles.col}>{gender}</td>
                  <td className={styles.col}>{size}</td>
                  <td className={`${styles.col} ${styles.dimCol}`}>{length}</td>
                  <td className={`${styles.col} ${styles.numeric}`}>{item.qty}</td>
                  <td className={`${styles.col} ${styles.numeric}`}>{item.qtyReserved}</td>
                  <td className={`${styles.col} ${styles.numeric}`}>{available}</td>
                  <td className={styles.col}>
                    <StatusChip status={chip.status} label={chip.label} size="sm" />
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
            {PAGINATION_PREV}
          </button>

          <div className={styles.pageInfo}>
            {PAGINATION_PAGE} {page + 1} {PAGINATION_OF} {totalPages}
          </div>

          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
          >
            {PAGINATION_NEXT}
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
