import React, { useRef, useEffect, useState } from 'react';
import { Warehouse, Filter, ChevronDown, Eye, Settings, Plus, Download, AlertCircle, HelpCircle } from 'lucide-react';
import { Button } from '../../../../shared/ui/Button';
import { Badge } from '../../../../shared/ui/Badge';
import { SearchInput } from '../../../../shared/ui/SearchInput';
import styles from './WarehouseHeader.module.css';

type StatusFilter = 'all' | 'instock' | 'reserved' | 'empty';
type ListMode = 'tree' | 'sku';

interface WarehouseHeaderProps {
  alertCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  listMode: ListMode;
  onListModeChange: (value: ListMode) => void;
  statsOpen: boolean;
  onStatsToggle: (open: boolean) => void;
  filterOpen: boolean;
  onFilterOpen: (open: boolean) => void;
  viewOpen: boolean;
  onViewOpen: (open: boolean) => void;
  onAddClick: () => void;
  onExportClick: () => void;
  exporting?: boolean;
  verificationView: boolean;
  onVerificationViewChange: (value: boolean) => void;
}

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Все остатки' },
  { value: 'instock', label: 'В наличии' },
  { value: 'reserved', label: 'Зарезервировано' },
  { value: 'empty', label: 'Нет' },
];

export const WarehouseHeader: React.FC<WarehouseHeaderProps> = ({
  alertCount,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  listMode,
  onListModeChange,
  statsOpen,
  onStatsToggle,
  filterOpen,
  onFilterOpen,
  viewOpen,
  onViewOpen,
  onAddClick,
  onExportClick,
  exporting = false,
  verificationView,
  onVerificationViewChange,
}) => {
  const filterRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const infoWrapRef = useRef<HTMLDivElement>(null);
  const [popupFlipLeft, setPopupFlipLeft] = useState(false);

  const currentStatusLabel =
    STATUS_FILTER_OPTIONS.find((option) => option.value === statusFilter)?.label || 'Фильтр';

  const handleFilterClick = (value: StatusFilter) => {
    onStatusFilterChange(value);
    onFilterOpen(false);
  };

  const handleListModeChange = (mode: ListMode) => {
    onListModeChange(mode);
    onViewOpen(false);
  };

  useEffect(() => {
    const POPUP_WIDTH = 260;
    const SAFE_MARGIN = 16;
    const updateFlip = () => {
      const node = infoWrapRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      setPopupFlipLeft(rect.right - POPUP_WIDTH < SAFE_MARGIN);
    };
    updateFlip();
    window.addEventListener('resize', updateFlip);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined' && infoWrapRef.current?.parentElement) {
      ro = new ResizeObserver(updateFlip);
      ro.observe(infoWrapRef.current.parentElement);
    }
    return () => {
      window.removeEventListener('resize', updateFlip);
      ro?.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        onFilterOpen(false);
      }

      if (viewRef.current && !viewRef.current.contains(event.target as Node)) {
        onViewOpen(false);
      }
    };

    if (filterOpen || viewOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [filterOpen, viewOpen, onFilterOpen, onViewOpen]);

  return (
    <header className={styles.header}>
      <div className={styles.row}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>
            <Warehouse size={20} />
            Склад
          </h1>
          {(alertCount > 0 || verificationView) && (
            <button
              type="button"
              className={`${styles.verificationToggle} ${verificationView ? styles.verificationToggleActive : ''}`}
              onClick={() => onVerificationViewChange(!verificationView)}
              title={verificationView ? 'Вернуться к фактическим остаткам' : 'Показать карточки, требующие проверки'}
            >
              <AlertCircle size={14} />
              <span className={styles.verificationToggleLabel}>
                {verificationView ? 'Все остатки' : 'Требуют проверки'}
              </span>
              {alertCount > 0 && !verificationView && (
                <Badge variant="danger">{alertCount}</Badge>
              )}
            </button>
          )}
        </div>

        <div className={styles.searchInput}>
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Поиск товара, SKU..."
          />
        </div>

        <div className={styles.dropdownWrapper} ref={filterRef}>
          <button
            className={`${styles.dropdownTrigger} ${filterOpen ? styles.active : ''}`}
            onClick={() => onFilterOpen(!filterOpen)}
          >
            <Filter size={16} />
            <span>{currentStatusLabel}</span>
            <ChevronDown size={14} />
          </button>
          {filterOpen && (
            <div className={styles.dropdownMenu}>
              {STATUS_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`${styles.dropdownItem} ${statusFilter === option.value ? styles.active : ''}`}
                  onClick={() => handleFilterClick(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.dropdownWrapper} ref={viewRef}>
          <button
            className={`${styles.dropdownTrigger} ${viewOpen ? styles.active : ''}`}
            onClick={() => onViewOpen(!viewOpen)}
          >
            <Eye size={16} />
            <span>Вид</span>
            <ChevronDown size={14} />
          </button>
          {viewOpen && (
            <div className={styles.dropdownMenu}>
              <div className={styles.dropdownSection}>
                <div className={styles.sectionLabel}>Отображение</div>
                <button
                  className={`${styles.dropdownItem} ${listMode === 'tree' ? styles.active : ''}`}
                  onClick={() => handleListModeChange('tree')}
                >
                  По каталогу
                </button>
                <button
                  className={`${styles.dropdownItem} ${listMode === 'sku' ? styles.active : ''}`}
                  onClick={() => handleListModeChange('sku')}
                >
                  Таблица SKU
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.divider} />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onStatsToggle(!statsOpen)}
          className={styles.btn}
        >
          <Settings size={16} />
          <span className={styles.metricsText}>Метрики</span>
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={onAddClick}
          className={styles.btn}
        >
          <Plus size={16} />
          Добавить
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={onExportClick}
          disabled={exporting}
          loading={exporting}
          className={styles.btn}
        >
          {!exporting && <Download size={16} />}
          {exporting ? 'Экспорт...' : 'Экспорт'}
        </Button>

        <div className={styles.infoWrap} ref={infoWrapRef}>
          <span className={styles.infoIcon}>
            <HelpCircle size={16} />
          </span>
          <div className={`${styles.infoPopup} ${popupFlipLeft ? styles.infoPopupLeft : ''}`}>
            <div className={styles.infoPopupTitle}>Экспорт остатков</div>
            <div className={styles.infoPopupText}>
              Скачивает Excel-файл со всеми позициями склада: название, артикул, цвет, размер,
              длина, количество, резерв, доступно, цена и категория.
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
