import React, { useRef, useEffect, useState } from 'react';
import { Warehouse, Search, Filter, ChevronDown, Eye, Settings, Plus, Download, AlertCircle } from 'lucide-react';
import { Button } from '../../../../shared/ui/Button';
import { Badge } from '../../../../shared/ui/Badge';
import { SearchInput } from '../../../../shared/ui/SearchInput';
import styles from './WarehouseHeader.module.css';

type StatusFilter = 'all' | 'instock' | 'reserved' | 'empty';
type ViewMode = 'default' | 'compact';
type ListMode = 'tree' | 'sku';

interface WarehouseHeaderProps {
  alertCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  viewMode: ViewMode;
  onViewModeChange: (value: ViewMode) => void;
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
  viewMode,
  onViewModeChange,
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
}) => {
  const filterRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);

  const currentStatusLabel = STATUS_FILTER_OPTIONS.find(o => o.value === statusFilter)?.label || 'Фильтр';

  const handleFilterClick = (value: StatusFilter) => {
    onStatusFilterChange(value);
    onFilterOpen(false);
  };

  const handleListModeChange = (mode: ListMode) => {
    onListModeChange(mode);
    onViewOpen(false);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    onViewModeChange(mode);
    onViewOpen(false);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        onFilterOpen(false);
      }
      if (viewRef.current && !viewRef.current.contains(e.target as Node)) {
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
        {/* Title + Alert Badge */}
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>
            <Warehouse size={20} />
            Склад
          </h1>
          {alertCount > 0 && (
            <Badge variant="danger">
              <AlertCircle size={14} />
              {alertCount}
            </Badge>
          )}
        </div>

        {/* Search Input */}
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Поиск товара, SKU..."
          className={styles.searchInput}
        />

        {/* Filter Dropdown */}
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
              {STATUS_FILTER_OPTIONS.map(option => (
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

        {/* View Dropdown */}
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
              <div className={styles.dropdownDivider} />
              <div className={styles.dropdownSection}>
                <div className={styles.sectionLabel}>Плотность</div>
                <button
                  className={`${styles.dropdownItem} ${viewMode === 'default' ? styles.active : ''}`}
                  onClick={() => handleViewModeChange('default')}
                >
                  Обычная
                </button>
                <button
                  className={`${styles.dropdownItem} ${viewMode === 'compact' ? styles.active : ''}`}
                  onClick={() => handleViewModeChange('compact')}
                >
                  Компактная
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.divider} />

        {/* Action Buttons */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onStatsToggle(!statsOpen)}
          className={styles.btn}
        >
          <Settings size={16} />
          Метрики
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
          className={styles.btn}
        >
          <Download size={16} />
          Экспорт
        </Button>
      </div>
    </header>
  );
};
