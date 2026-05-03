import { useMemo } from 'react';
import { useOrders, useInvoices } from '@/entities/order/queries';
import { detectAnomalies, detectInvoiceAnomalies, groupByManager, countByStatus } from './chapanMonitor.utils';

const ACTIVE_STATUSES = 'new,confirmed,in_production,ready,transferred,on_warehouse,shipped';

export function useChapanMonitor() {
  const { data: ordersData, isLoading: ordersLoading } = useOrders({ statuses: ACTIVE_STATUSES, limit: 500 });
  const { data: rejectedData } = useInvoices({ status: 'rejected', limit: 100 });
  const { data: pendingData } = useInvoices({ status: 'pending_confirmation', limit: 100 });

  const orders = useMemo(() => ordersData?.results ?? [], [ordersData]);
  const invoices = useMemo(
    () => [...(rejectedData?.results ?? []), ...(pendingData?.results ?? [])],
    [rejectedData, pendingData],
  );

  const anomalies = useMemo(
    () => [...detectAnomalies(orders), ...detectInvoiceAnomalies(invoices)],
    [orders, invoices],
  );
  const managerGroups = useMemo(() => groupByManager(orders), [orders]);
  const statusCounts = useMemo(() => countByStatus(orders), [orders]);

  return {
    orders,
    isLoading: ordersLoading,
    anomalies,
    anomalyCount: anomalies.length,
    managerGroups,
    statusCounts,
  };
}
