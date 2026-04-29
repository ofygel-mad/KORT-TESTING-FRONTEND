import React, { useMemo, useState } from 'react';
import { ChevronDown, Package } from 'lucide-react';
import { useWarehouseItems } from '../../../../entities/warehouse/queries';
import type { WarehouseItem } from '../../../../entities/warehouse/types';
import { getStockStatus } from '../../../../entities/warehouse/types';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { EmptyState } from '../../../../shared/ui/EmptyState';
import { StatusChip } from '../../../../shared/ui/StatusChip';
import { groupItemsByProduct, filterItemsByStatus } from './warehouseGrouping';
import styles from './WarehouseCatalog.module.css';

type StatusFilter = 'all' | 'instock' | 'reserved' | 'empty';
type ViewMode = 'default' | 'compact';

interface WarehouseCatalogProps {
  search: string;
  viewMode: ViewMode;
  statusFilter: StatusFilter;
  onSelectItem: (itemId: string) => void;
}

export const WarehouseCatalog: React.FC<WarehouseCatalogProps> = ({
  search,
  viewMode,
  statusFilter,
  onSelectItem,
}) => {
  const { data: items, isLoading } = useWarehouseItems({
    search: search || undefined,
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
    const filtered = filterItemsByStatus(items, statusFilter);
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
          icon={Package}
        />
      </div>
    );
  }

  const mapStockStatusToChip = (status: string): 'ok' | 'warn' | 'err' | 'info' => {
    if (status === 'critical') return 'err';
    if (status === 'low') return 'warn';
    return 'ok';
  };

  const getWorstStatus = (itemsGroup: WarehouseItem[]): 'ok' | 'warn' | 'err' | 'info' => {
    // Determine worst stock status in group
    const statuses = itemsGroup.map(getStockStatus);
    if (statuses.some(s => s === 'critical')) return 'err';
    if (statuses.some(s => s === 'low')) return 'warn';
    return 'ok';
  };

  return (
    <div className={`${styles.catalog} ${styles[`view-${viewMode}`]}`}>
      {filteredAndGrouped.map(group => {
        const isExpanded = expandedProducts.has(group.name);
        const worstStatus = getWorstStatus(group.items);

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
              <div className={styles.cardTitleGroup}>
                {viewMode === 'default' && (
                  <Package size={20} className={styles.cardIcon} />
                )}
                <div>
                  <div className={styles.cardTitle}>{group.name}</div>
                  <div className={styles.cardSubtitle}>
                    Всего: <strong>{group.totalQty}</strong> шт
                    {group.totalReserved > 0 && (
                      <> · Зарезерв: <strong>{group.totalReserved}</strong> шт</>
                    )}
                  </div>
                </div>
              </div>
              <StatusChip status={worstStatus} size="sm" />
            </button>

            {isExpanded && (
              <div className={styles.cardBody}>
                {/* Size breakdown */}
                {group.sizeBreakdown.length > 0 && (
                  <SizeBreakdownSection items={group.sizeBreakdown} />
                )}

                {/* Color breakdown */}
                {group.colorBreakdown.length > 0 && (
                  <ColorBreakdownSection items={group.colorBreakdown} />
                )}

                {/* All SKU table */}
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

interface SizeBreakdownSectionProps {
  items: Array<{ value: string; qty: number; reserved: number }>;
}

const SizeBreakdownSection: React.FC<SizeBreakdownSectionProps> = ({ items }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={styles.subgroup}>
      <button type="button" className={styles.subgroupHeader} onClick={() => setExpanded(!expanded)}>
        <ChevronDown size={16} className={`${styles.chevron} ${expanded ? styles.expanded : ''}`} />
        <span className={styles.subgroupTitle}>По размерам</span>
        <span className={styles.subgroupBadge}>{items.length}</span>
      </button>
      {expanded && (
        <div className={styles.subgroupBody}>
          {items.map(item => (
            <div key={item.value} className={styles.breakdownRow}>
              <span className={styles.breakdownLabel}>Размер {item.value}</span>
              <span className={styles.breakdownValue}>{item.qty} шт</span>
              {item.reserved > 0 && (
                <span className={styles.breakdownReserved}>зарез. {item.reserved}</span>
              )}
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

  return (
    <div className={styles.subgroup}>
      <button type="button" className={styles.subgroupHeader} onClick={() => setExpanded(!expanded)}>
        <ChevronDown size={16} className={`${styles.chevron} ${expanded ? styles.expanded : ''}`} />
        <span className={styles.subgroupTitle}>По цветам</span>
        <span className={styles.subgroupBadge}>{items.length}</span>
      </button>
      {expanded && (
        <div className={styles.subgroupBody}>
          {items.map(item => (
            <div key={item.value} className={styles.breakdownRow}>
              <span className={styles.breakdownLabel}>Цвет {item.value}</span>
              <span className={styles.breakdownValue}>{item.qty} шт</span>
              {item.reserved > 0 && (
                <span className={styles.breakdownReserved}>зарез. {item.reserved}</span>
              )}
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
        <span className={styles.subgroupTitle}>Все SKU</span>
        <span className={styles.subgroupBadge}>{items.length}</span>
      </button>
      {expanded && (
        <div className={styles.skuTable}>
          <div className={styles.skuTableHead}>
            <div className={styles.skuCol}>SKU</div>
            <div className={styles.skuCol}>В наличии</div>
            <div className={styles.skuCol}>Зарез</div>
            <div className={styles.skuCol}>Доступно</div>
            <div className={styles.skuCol}>Статус</div>
          </div>
          {items.map(item => {
            const available = item.qty - item.qtyReserved;
            const status = getStockStatus(item);
            return (
              <div
                key={item.id}
                className={styles.skuTableRow}
                onClick={() => onSelectItem(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectItem(item.id);
                  }
                }}
              >
                <div className={styles.skuCol}>{item.sku || '—'}</div>
                <div className={styles.skuCol}>{item.qty}</div>
                <div className={styles.skuCol}>{item.qtyReserved}</div>
                <div className={styles.skuCol}>{available}</div>
                <div className={styles.skuCol}>
                  <StatusChip status={status} size="sm" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
