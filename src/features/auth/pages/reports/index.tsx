import { useState } from 'react';
import { Download, TrendingUp, Users, Factory, Megaphone } from 'lucide-react';
import { useLeads } from '@/entities/lead/queries';
import { useDeals } from '@/entities/deal/queries';
import { useOrders } from '@/entities/order/queries';
import { Skeleton } from '../../shared/ui/Skeleton';
import { exportToCSV } from '../../shared/lib/export';
import { calculateChapanOrderFinancials } from '@/shared/lib/chapanFinancials';

function orderTotalDue(o: { totalAmount?: number; orderDiscount?: number; deliveryFee?: number; bankCommissionPercent?: number; bankCommissionAmount?: number }) {
  return calculateChapanOrderFinancials({
    itemsSubtotal: o.totalAmount ?? 0,
    orderDiscount: o.orderDiscount,
    deliveryFee: o.deliveryFee,
    bankCommissionPercent: o.bankCommissionPercent,
    bankCommissionAmount: o.bankCommissionAmount,
  }).totalDue;
}
import styles from './Reports.module.css';
import AdsReport from './AdsReport';

type Tab = 'sales' | 'funnel' | 'production' | 'ads';

const REPORTS_TAB_KEY = 'reports:tab';
const VALID_TABS: Tab[] = ['sales', 'funnel', 'production', 'ads'];
function readStoredTab(): Tab {
  const v = localStorage.getItem(REPORTS_TAB_KEY);
  return VALID_TABS.includes(v as Tab) ? (v as Tab) : 'sales';
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n) + ' ₸';
}
function fmtPct(n: number) {
  return n.toFixed(1) + '%';
}
function monthStart(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset, 1);
  d.setHours(0,0,0,0);
  return d.toISOString().slice(0,10);
}
function monthEnd(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset + 1, 0);
  d.setHours(23,59,59,999);
  return d.toISOString().slice(0,10);
}

// ── Sales tab ──────────────────────────────────────────────────────────────────

function SalesReport() {
  const { data: dealsData, isLoading } = useDeals({ limit: 500 });
  const { data: ordersData } = useOrders({ limit: 500 });
  const deals = (dealsData as any)?.results ?? [];
  const orders = (ordersData as any)?.results ?? [];

  // Won deals by assignee
  const wonDeals = deals.filter((d: any) => d.stage === 'won');
  const byManager: Record<string, { deals: number; amount: number }> = {};
  wonDeals.forEach((d: any) => {
    const name = d.assignedName ?? 'Без менеджера';
    if (!byManager[name]) byManager[name] = { deals: 0, amount: 0 };
    byManager[name].deals++;
    byManager[name].amount += d.amount ?? 0;
  });

  // Orders by manager (Chapan)
  const completedOrders = orders.filter((o: any) => o.status === 'completed' || o.status === 'transferred');
  const totalRevenue = completedOrders.reduce((s: number, o: any) => s + orderTotalDue(o), 0);
  const totalPaid = completedOrders.reduce((s: number, o: any) => s + (o.paidAmount ?? 0), 0);

  function handleExport() {
    exportToCSV(
      Object.entries(byManager).map(([name, d]) => ({ 'Менеджер': name, 'Сделок закрыто': d.deals, 'Сумма': d.amount })),
      'отчёт_продажи.csv'
    );
  }

  return (
    <div className={styles.reportSection}>
      {isLoading ? <Skeleton height={200} radius={10} /> : (
        <>
          <div className={styles.summaryRow}>
            <div className={styles.summaryCard}>
              <div className={styles.scLabel}>Сделок закрыто</div>
              <div className={styles.scValue}>{wonDeals.length}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.scLabel}>Сумма сделок</div>
              <div className={styles.scValue} style={{ color:'var(--fill-positive)' }}>
                {fmtMoney(wonDeals.reduce((s: number, d: any) => s + (d.amount ?? 0), 0))}
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.scLabel}>Выручка Чапан</div>
              <div className={styles.scValue} style={{ color:'var(--fill-positive)' }}>
                {fmtMoney(totalRevenue)}
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.scLabel}>Оплачено</div>
              <div className={styles.scValue}>{fmtMoney(totalPaid)}</div>
            </div>
          </div>

          {Object.keys(byManager).length > 0 && (
            <div className={styles.tableCard}>
              <div className={styles.tableCardHeader}>
                <span className={styles.tableCardTitle}>По менеджерам (закрытые сделки)</span>
                <button className={styles.exportMini} onClick={handleExport}><Download size={12} /> CSV</button>
              </div>
              <table className={styles.table}>
                <thead><tr><th>Менеджер</th><th style={{textAlign:'right'}}>Сделок</th><th style={{textAlign:'right'}}>Сумма</th></tr></thead>
                <tbody>
                  {Object.entries(byManager).sort(([,a],[,b]) => b.amount - a.amount).map(([name, data]) => (
                    <tr key={name} className={styles.row}>
                      <td className={styles.tdName}>{name}</td>
                      <td style={{textAlign:'right',color:'var(--text-secondary)'}}>{data.deals}</td>
                      <td style={{textAlign:'right',fontWeight:500,color:'var(--fill-positive)'}}>{fmtMoney(data.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {wonDeals.length === 0 && Object.keys(byManager).length === 0 && (
            <div className={styles.empty}><p>Нет закрытых сделок за период</p></div>
          )}
        </>
      )}
    </div>
  );
}

// ── Funnel tab ─────────────────────────────────────────────────────────────────

function FunnelReport() {
  const { data: leadsData, isLoading: leadsLoading } = useLeads({ limit: 500 });
  const { data: dealsData, isLoading: dealsLoading } = useDeals({ limit: 500 });
  const leads = (leadsData as any)?.results ?? [];
  const deals = (dealsData as any)?.results ?? [];

  const leadStages = [
    { key: 'new', label: 'Новые лиды' },
    { key: 'in_progress', label: 'В работе' },
    { key: 'won', label: 'Конвертированы' },
    { key: 'lost', label: 'Отказ' },
  ];

  const dealStages = [
    { key: 'new', label: 'Новые сделки' },
    { key: 'qualified', label: 'Квалификация' },
    { key: 'proposal', label: 'КП отправлено' },
    { key: 'negotiation', label: 'Переговоры' },
    { key: 'won', label: 'Выиграно' },
    { key: 'lost', label: 'Потеряно' },
  ];

  const totalLeads = leads.length;

  function handleExport() {
    const rows = [
      ...leadStages.map(s => ({ 'Воронка': 'Лиды', 'Стадия': s.label, 'Кол-во': leads.filter((l: any) => l.stage === s.key).length })),
      ...dealStages.map(s => ({
        'Воронка': 'Сделки', 'Стадия': s.label,
        'Кол-во': deals.filter((d: any) => d.stage === s.key).length,
        'Сумма': deals.filter((d: any) => d.stage === s.key).reduce((s: number, d: any) => s + (d.amount ?? 0), 0),
      })),
    ];
    exportToCSV(rows, 'отчёт_воронка.csv');
  }

  return (
    <div className={styles.reportSection}>
      {(leadsLoading || dealsLoading) ? <Skeleton height={200} radius={10} /> : (
        <>
          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <span className={styles.tableCardTitle}>Лиды</span>
              <button className={styles.exportMini} onClick={handleExport}><Download size={12} /> CSV</button>
            </div>
            <table className={styles.table}>
              <thead><tr><th>Стадия</th><th style={{textAlign:'right'}}>Кол-во</th><th style={{textAlign:'right'}}>% от входа</th></tr></thead>
              <tbody>
                {leadStages.map(s => {
                  const count = leads.filter((l: any) => l.stage === s.key).length;
                  return (
                    <tr key={s.key} className={styles.row}>
                      <td className={styles.tdName}>{s.label}</td>
                      <td style={{textAlign:'right',fontWeight:500,color:'var(--text-primary)'}}>{count}</td>
                      <td style={{textAlign:'right',color:'var(--text-tertiary)'}}>
                        {totalLeads > 0 ? fmtPct(count / totalLeads * 100) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <span className={styles.tableCardTitle}>Сделки</span>
            </div>
            <table className={styles.table}>
              <thead><tr><th>Стадия</th><th style={{textAlign:'right'}}>Кол-во</th><th style={{textAlign:'right'}}>Сумма</th></tr></thead>
              <tbody>
                {dealStages.map(s => {
                  const stageDeals = deals.filter((d: any) => d.stage === s.key);
                  const total = stageDeals.reduce((sum: number, d: any) => sum + (d.amount ?? 0), 0);
                  return (
                    <tr key={s.key} className={styles.row}>
                      <td className={styles.tdName}>{s.label}</td>
                      <td style={{textAlign:'right',color:'var(--text-secondary)'}}>{stageDeals.length}</td>
                      <td style={{textAlign:'right',color: s.key==='won' ? 'var(--fill-positive)' : 'var(--text-secondary)',fontWeight: s.key==='won' ? 600 : 400}}>
                        {total > 0 ? fmtMoney(total) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Production tab ─────────────────────────────────────────────────────────────

function ProductionReport() {
  const { data: ordersData, isLoading } = useOrders({ limit: 500 });
  const orders = (ordersData as any)?.results ?? [];

  const STATUS_LABEL: Record<string, string> = {
    new: 'Новые', confirmed: 'Подтверждённые', in_production: 'В цехе',
    ready: 'Готовы', transferred: 'Переданы', completed: 'Завершены', cancelled: 'Отменены',
  };

  const byStatus: Record<string, { count: number; total: number }> = {};
  orders.forEach((o: any) => {
    if (!byStatus[o.status]) byStatus[o.status] = { count: 0, total: 0 };
    byStatus[o.status].count++;
    byStatus[o.status].total += orderTotalDue(o);
  });

  const total = orders.reduce((s: number, o: any) => s + orderTotalDue(o), 0);
  const paid = orders.reduce((s: number, o: any) => s + (o.paidAmount ?? 0), 0);

  function handleExport() {
    exportToCSV(
      Object.entries(byStatus).map(([status, d]) => ({
        'Статус': STATUS_LABEL[status] ?? status,
        'Заказов': d.count,
        'Сумма': d.total,
      })),
      'отчёт_производство.csv'
    );
  }

  return (
    <div className={styles.reportSection}>
      {isLoading ? <Skeleton height={200} radius={10} /> : (
        <>
          <div className={styles.summaryRow}>
            <div className={styles.summaryCard}>
              <div className={styles.scLabel}>Всего заказов</div>
              <div className={styles.scValue}>{orders.length}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.scLabel}>Сумма заказов</div>
              <div className={styles.scValue} style={{color:'var(--fill-positive)'}}>{fmtMoney(total)}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.scLabel}>Оплачено</div>
              <div className={styles.scValue}>{fmtMoney(paid)}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.scLabel}>Долг</div>
              <div className={styles.scValue} style={{color:'var(--fill-warning)'}}>{fmtMoney(total - paid)}</div>
            </div>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <span className={styles.tableCardTitle}>По статусам</span>
              <button className={styles.exportMini} onClick={handleExport}><Download size={12} /> CSV</button>
            </div>
            <table className={styles.table}>
              <thead><tr><th>Статус</th><th style={{textAlign:'right'}}>Заказов</th><th style={{textAlign:'right'}}>Сумма</th></tr></thead>
              <tbody>
                {Object.entries(byStatus).map(([status, data]) => (
                  <tr key={status} className={styles.row}>
                    <td className={styles.tdName}>{STATUS_LABEL[status] ?? status}</td>
                    <td style={{textAlign:'right',color:'var(--text-secondary)'}}>{data.count}</td>
                    <td style={{textAlign:'right',color:'var(--text-primary)',fontWeight:500}}>
                      {data.total > 0 ? fmtMoney(data.total) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {orders.length === 0 && <div className={styles.empty}><p>Нет заказов за период</p></div>}
        </>
      )}
    </div>
  );
}

// ── Ads tab ────────────────────────────────────────────────────────────────────

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>(readStoredTab);

  function handleSetTab(next: Tab) {
    setTab(next);
    localStorage.setItem(REPORTS_TAB_KEY, next);
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Отчёты</h1>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab==='sales' ? styles.tabActive : ''}`} onClick={() => handleSetTab('sales')}>
            <TrendingUp size={13} /> Продажи
          </button>
          <button className={`${styles.tab} ${tab==='funnel' ? styles.tabActive : ''}`} onClick={() => handleSetTab('funnel')}>
            <Users size={13} /> Воронка CRM
          </button>
          <button className={`${styles.tab} ${tab==='production' ? styles.tabActive : ''}`} onClick={() => handleSetTab('production')}>
            <Factory size={13} /> Производство
          </button>
          <button className={`${styles.tab} ${tab==='ads' ? styles.tabActive : ''}`} onClick={() => handleSetTab('ads')}>
            <Megaphone size={13} /> Рекламный кабинет
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {tab === 'sales' && <SalesReport />}
        {tab === 'funnel' && <FunnelReport />}
        {tab === 'production' && <ProductionReport />}
        {tab === 'ads' && <AdsReport />}
      </div>
    </div>
  );
}
