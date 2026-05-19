import { useDeferredValue, useState, useCallback } from 'react';
import { exportWarehouseToExcel } from './exportWarehouse';
import { useWarehouseItems, useWarehouseSummary, useWarehouseAlerts } from '@/entities/warehouse/queries';
import { WarehouseHeader } from './WarehouseHeader';
import { WarehouseStats } from './WarehouseStats';
import { WarehouseCatalog as WarehouseInventoryCatalog } from './WarehouseCatalog';
import { WarehouseSkuTable } from './WarehouseSkuTable';
import { ItemDetailDrawer } from './ItemDetailDrawer';
import { AddItemDrawer } from './AddItemDrawer';
import whStyles from './WarehouseTokens.module.css';
import styles from './WarehousePage.module.css';

type StatusFilter = 'all' | 'instock' | 'reserved' | 'empty';
type ListMode = 'tree' | 'sku';

export const WarehousePage: React.FC = () => {
  const [statsOpen, setStatsOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [listMode, setListMode] = useState<ListMode>('tree');
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [itemDrawerOpen, setItemDrawerOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [verificationView, setVerificationView] = useState(false);

  const { data: summary } = useWarehouseSummary();
  const { data: alerts } = useWarehouseAlerts();

  const deferredSearch = useDeferredValue(search);

  const { data: itemsData } = useWarehouseItems({
    search: deferredSearch || undefined,
    verificationRequired: verificationView,
  });

  const selectedItem = selectedItemId && itemsData?.results?.find(item => item.id === selectedItemId);

  const handleSelectItem = useCallback((itemId: string) => {
    setSelectedItemId(itemId);
    setItemDrawerOpen(true);
  }, []);

  const handleCloseItemDrawer = useCallback(() => {
    setItemDrawerOpen(false);
    setSelectedItemId(null);
  }, []);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportWarehouseToExcel();
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  const handleAddItem = () => {
    setAddItemOpen(true);
  };

  const alertCount = alerts?.count ?? 0;
  const statsSummary = summary ?? {
    totalItems: 0,
    totalValue: 0,
    lowStockCount: 0,
    categories: 0,
  };

  return (
    <div className={`${styles.root} ${whStyles.whRoot}`}>
      <WarehouseHeader
        alertCount={alertCount}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
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
        exporting={exporting}
        verificationView={verificationView}
        onVerificationViewChange={setVerificationView}
      />

      {verificationView && (
        <div className={styles.verificationBanner}>
          Это карточки товаров, автоматически созданные при оформлении заказов.
          У них нет фактического остатка (qty=0) — нужно проверить и привязать к реальным позициям склада.
        </div>
      )}

      {statsOpen && <WarehouseStats summary={statsSummary} />}

      <div className={styles.content}>
        {listMode === 'tree' ? (
          <WarehouseInventoryCatalog
            search={deferredSearch}
            statusFilter={statusFilter}
            onSelectItem={handleSelectItem}
            verificationRequired={verificationView}
          />
        ) : (
          <WarehouseSkuTable
            search={deferredSearch}
            statusFilter={statusFilter}
            onSelectItem={handleSelectItem}
            verificationRequired={verificationView}
          />
        )}
      </div>

      {itemDrawerOpen && selectedItem && (
        <ItemDetailDrawer
          item={selectedItem}
          onClose={handleCloseItemDrawer}
          onAddMovement={() => {
            console.log('Add movement triggered');
          }}
        />
      )}

      {addItemOpen && <AddItemDrawer onClose={() => setAddItemOpen(false)} />}
    </div>
  );
};

export default WarehousePage;
