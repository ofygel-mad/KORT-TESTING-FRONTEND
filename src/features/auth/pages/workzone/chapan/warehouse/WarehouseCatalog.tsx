import React, { useMemo, useState } from 'react';
import { ChevronDown, Package } from 'lucide-react';
import { useWarehouseItems } from '@/entities/warehouse/queries';
import type { WarehouseItem } from '@/entities/warehouse/types';
import { getStockStatus } from '@/entities/warehouse/types';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { EmptyState } from '../../../../shared/ui/EmptyState';
import { StatusChip } from '../../../../shared/ui/StatusChip';
import { groupItemsByProduct, filterItemsByStatus } from './warehouseGrouping';
import styles from './WarehouseCatalog.module.css';

type StatusFilter = 'all' | 'instock' | 'reserved' | 'empty';

const mapStockStatusToChip = (status: 'ok' | 'low' | 'critical'): 'ok' | 'warn' | 'err' | 'info' => {
  if (status === 'critical') return 'err';
  if (status === 'low') return 'warn';
  return 'ok';
};

interface WarehouseCatalogProps {
  search: string;
  statusFilter: StatusFilter;
  onSelectItem: (itemId: string) => void;
  verificationRequired?: boolean;
}

export const WarehouseCatalog: React.FC<WarehouseCatalogProps> = ({
  search,
  statusFilter,
  onSelectItem,
  verificationRequired,
}) => {
  const { data: items, isLoading } = useWarehouseItems({
    search: search || undefined,
    verificationRequired,
  });

  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  const toggleProductExpand = (productName: string) => {
    const next = new Set(expandedProducts);
    if (next.has(productName)) {
      next.delete(productName);
    } else {
      next.add(productName);
    }
    setExpandedProducts(next);
  };

  const filteredAndGrouped = useMemo(() => {
    if (!items) return [];
    const itemsArray = items.results || [];
    const filtered = filterItemsByStatus(itemsArray, statusFilter);
    return groupItemsByProduct(filtered);
  }, [items, statusFilter]);

  if (isLoading) {
    return (
      <div className={styles.catalog}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={styles.cardSkeleton}>
            <Skeleton width="60%" height={24} />
            <Skeleton width="40%" height={16} style={{ marginTop: 8 }} />
          </div>
        ))}
      </div>
    );
  }

  if (!filteredAndGrouped || filteredAndGrouped.length === 0) {
    return (
      <div className={styles.catalog}>
        <EmptyState
          title="Нет товаров"
          description="Попробуйте изменить фильтры или выполнить поиск"
        />
      </div>
    );
  }

  return (
    <div className={styles.catalog}>
      {filteredAndGrouped.map(group => {
        const isExpanded = expandedProducts.has(group.name);

        return (
          <div key={group.name} className={styles.productCard}>
            <button
              type="button"
              className={styles.cardHeader}
              onClick={() => toggleProductExpand(group.name)}
            >
              <ChevronDown
                size={18}
                className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`}
              />
              <Package size={20} className={styles.cardIcon} />
              <span className={styles.cardTitle}>{group.name}</span>
              <span className={styles.cardQty}>{group.totalQty} пол.</span>
            </button>

            {isExpanded && (
              <div className={styles.cardBody}>
                {group.sizeBreakdown.length > 0 && (
                  <SizeBreakdownSection items={group.sizeBreakdown} />
                )}

                {group.colorBreakdown.length > 0 && (
                  <ColorBreakdownSection items={group.colorBreakdown} />
                )}

                <SkuTableSection
                  items={group.items}
                  onSelectItem={onSelectItem}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Sub-sections ────────────────────────────────────────────────────────────

interface SizeBreakdownSectionProps {
  items: Array<{ value: string; qty: number; reserved: number }>;
}

const SizeBreakdownSection: React.FC<SizeBreakdownSectionProps> = ({ items }) => {
  const [expanded, setExpanded] = useState(false);
  const total = items.reduce((s, x) => s + x.qty, 0);

  return (
    <div className={styles.subgroup}>
      <button type="button" className={styles.subgroupHeader} onClick={() => setExpanded(!expanded)}>
        <ChevronDown size={16} className={`${styles.chevron} ${expanded ? styles.expanded : ''}`} />
        <span className={styles.subgroupTitle}>по размерам</span>
        <span className={styles.subgroupTotalLabel}>итого</span>
        <span className={styles.subgroupTotal}>{total}</span>
      </button>
      {expanded && (
        <div className={styles.subgroupBody}>
          {items.map(item => (
            <div key={item.value} className={styles.breakdownRow}>
              <span className={styles.breakdownArrow}>›</span>
              <span className={styles.breakdownAttr}>{item.value}</span>
              <span className={styles.breakdownEq}>= {item.qty}</span>
              <button type="button" className={styles.breakdownAll}>все</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface ColorBreakdownSectionProps {
  items: Array<{ value: string; qty: number; reserved: number }>;
}

const ColorBreakdownSection: React.FC<ColorBreakdownSectionProps> = ({ items }) => {
  const [expanded, setExpanded] = useState(false);
  const total = items.reduce((s, x) => s + x.qty, 0);

  return (
    <div className={styles.subgroup}>
      <button type="button" className={styles.subgroupHeader} onClick={() => setExpanded(!expanded)}>
        <ChevronDown size={16} className={`${styles.chevron} ${expanded ? styles.expanded : ''}`} />
        <span className={styles.subgroupTitle}>по цветам</span>
        <span className={styles.subgroupTotalLabel}>итого</span>
        <span className={styles.subgroupTotal}>{total}</span>
      </button>
      {expanded && (
        <div className={styles.subgroupBody}>
          {items.map(item => (
            <div key={item.value} className={styles.breakdownRow}>
              <span className={styles.breakdownArrow}>›</span>
              <span className={styles.breakdownAttr}>{item.value}</span>
              <span className={styles.breakdownEq}>= {item.qty}</span>
              <button type="button" className={styles.breakdownAll}>все</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface SkuTableSectionProps {
  items: WarehouseItem[];
  onSelectItem: (itemId: string) => void;
}

const SkuTableSection: React.FC<SkuTableSectionProps> = ({ items, onSelectItem }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={styles.subgroup}>
      <button type="button" className={styles.subgroupHeader} onClick={() => setExpanded(!expanded)}>
        <ChevronDown size={16} className={`${styles.chevron} ${expanded ? styles.expanded : ''}`} />
        <span className={styles.subgroupTitle}>по SKU</span>
        <span className={styles.subgroupBadge}>позиций {items.length}</span>
      </button>
      {expanded && (
        <div className={styles.skuInline}>
          <table className={styles.skuTbl}>
            <thead>
              <tr>
                <th className={styles.thLeft}>Цвет</th>
                <th className={styles.thLeft}>Пол</th>
                <th className={styles.thLeft}>Размер</th>
                <th className={styles.thDim}>Длина</th>
                <th className={styles.thRight}>В наличии</th>
                <th className={styles.thRight}>Резерв</th>
                <th className={styles.thRight}>Доступно</th>
                <th className={styles.thLeft}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const color = item.attributesJson?.['color'] || '—';
                const genderRaw = item.attributesJson?.['gender'];
                const gender = genderRaw
                  ? (() => {
                      const v = genderRaw.trim().toLowerCase();
                      if (v === 'male' || v === 'муж' || v === 'мужской') return 'Мужской';
                      if (v === 'female' || v === 'жен' || v === 'женский') return 'Женский';
                      return genderRaw;
                    })()
                  : '—';
                const size = item.attributesJson?.['size'] || '—';
                const length = item.attributesJson?.['length'] || null;
                const available = item.qty - item.qtyReserved;
                const chipStatus = mapStockStatusToChip(getStockStatus(item));
                return (
                  <tr
                    key={item.id}
                    className={styles.skuRow}
                    onClick={() => onSelectItem(item.id)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectItem(item.id);
                      }
                    }}
                  >
                    <td className={styles.tdBold}>{color}</td>
                    <td className={styles.tdMono}>{gender}</td>
                    <td className={styles.tdMono}>{size}</td>
                    <td className={styles.tdDim}>{length ?? '—'}</td>
                    <td className={styles.tdNum}>{item.qty}</td>
                    <td className={styles.tdNum}>{item.qtyReserved}</td>
                    <td className={styles.tdNum}>{available}</td>
                    <td className={styles.tdStatus}>
                      <StatusChip status={chipStatus} size="sm" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
