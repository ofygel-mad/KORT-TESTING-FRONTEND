import { useDeferredValue, useState, useCallback } from 'react';
import { Plus, Download } from 'lucide-react';
import { useWarehouseItems, useWarehouseSummary, useWarehouseAlerts } from '../../../../entities/warehouse/queries';
import { getStockStatus } from '../../../../entities/warehouse/types';
import { WarehouseHeader } from './WarehouseHeader';
import { WarehouseStats } from './WarehouseStats';
import { WarehouseCatalog } from './WarehouseCatalog';
import { WarehouseSkuTable } from './WarehouseSkuTable';
import { ItemDetailDrawer } from './ItemDetailDrawer';
import whStyles from './WarehouseTokens.module.css';
import styles from './WarehousePage.module.css';

type StatusFilter = 'all' | 'instock' | 'reserved' | 'empty';
type ViewMode = 'default' | 'compact';
type ListMode = 'tree' | 'sku';

export const WarehousePage: React.FC = () => {
  const [statsOpen, setStatsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('default');
  const [listMode, setListMode] = useState<ListMode>('tree');
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [itemDrawerOpen, setItemDrawerOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const { data: summary } = useWarehouseSummary();
  const { data: alerts } = useWarehouseAlerts();

  const deferredSearch = useDeferredValue(search);

  const handleSelectItem = useCallback((itemId: string) => {
    setSelectedItemId(itemId);
    setItemDrawerOpen(true);
  }, []);

  const handleCloseItemDrawer = useCallback(() => {
    setItemDrawerOpen(false);
    setSelectedItemId(null);
  }, []);

  const handleExport = () => {
    // Export functionality — to be implemented in next phase
    console.log('Export triggered');
  };

  const handleAddItem = () => {
    // Add item modal — to be implemented in next phase
    console.log('Add item triggered');
  };

  const alertCount = alerts?.length ?? 0;

  return (
    <div className={`${styles.root} ${whStyles.whRoot}`}>
      <WarehouseHeader
        alertCount={alertCount}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        listMode={listMode}
        onListModeChange={setListMode}
        statsOpen={statsOpen}
        onStatsToggle={setStatsOpen}
        filterOpen={filterOpen}
        onFilterOpen={setFilterOpen}
        viewOpen={viewOpen}
        onViewOpen={setViewOpen}
        onAddClick={handleAddItem}
        onExportClick={handleExport}
      />

      {statsOpen && summary && <WarehouseStats summary={summary} />}

      <div className={styles.content}>
        {listMode === 'tree' ? (
          <WarehouseCatalog
            search={deferredSearch}
            viewMode={viewMode}
            statusFilter={statusFilter}
            onSelectItem={handleSelectItem}
          />
        ) : (
          <WarehouseSkuTable
            search={deferredSearch}
            statusFilter={statusFilter}
            onSelectItem={handleSelectItem}
          />
        )}
      </div>

      <ItemDetailDrawer
        open={itemDrawerOpen}
        itemId={selectedItemId}
        onClose={handleCloseItemDrawer}
      />
    </div>
  );
};
