import { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { AlertCircle, BarChart2, LayoutGrid, TrendingUp } from 'lucide-react';
import { useChapanAnalytics } from '@/entities/analytics/queries';
import styles from './ChapanAnalytics.module.css';

type ViewMode = 'overview' | 'charts';
type Period = '7d' | '30d' | '90d' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  '7d': '7 дней',
  '30d': '30 дней',
  '90d': '90 дней',
  'all': 'Всё время',
};

const STATUS_RU: Record<string, string> = {
  new: 'Новый', confirmed: 'Подтверждён', in_production: 'В цехе',
  ready: 'Готов', transferred: 'Передан', on_warehouse: 'На складе',
  shipped: 'Отправлен', completed: 'Завершён', cancelled: 'Отменён',
};

const STATUS_COLORS: Record<string, string> = {
  new: '#7C3AED', confirmed: '#3B82F6', in_production: '#F59E0B',
  ready: '#10B981', transferred: '#8B5CF6', on_warehouse: '#8B5CF6',
  shipped: '#3B82F6', completed: '#4A5268', cancelled: '#EF4444',
};

const PIE_COLORS = ['#7C3AED', '#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444', '#4A5268', '#D0B06A', '#5FB889'];

function fmt(n: number) {
  return new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n) + ' ₸';
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M ₸';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K ₸';
  return n + ' ₸';
}

function periodToDates(period: Period): { dateFrom?: string; dateTo?: string } {
  if (period === 'all') return {};
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { dateFrom: from.toISOString().slice(0, 10) };
}

export default function ChapanAnalyticsPage() {
  const [view, setView] = useState<ViewMode>('overview');
  const [period, setPeriod] = useState<Period>('30d');

  const { data, isLoading, isError } = useChapanAnalytics(periodToDates(period));

  return (
    <div className={`${styles.root} kort-page-enter`}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <TrendingUp size={18} />
          <span>Аналитика</span>
        </div>
        <div className={styles.headerControls}>
          {/* Period selector */}
          <div className={styles.periodGroup}>
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`${styles.periodBtn} ${period === p ? styles.periodBtnActive : ''}`}
                onClick={() => setPeriod(p)}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className={styles.viewGroup}>
            <button
              type="button"
              className={`${styles.viewBtn} ${view === 'overview' ? styles.viewBtnActive : ''}`}
              onClick={() => setView('overview')}
              title="Таблицы"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              className={`${styles.viewBtn} ${view === 'charts' ? styles.viewBtnActive : ''}`}
              onClick={() => setView('charts')}
              title="Графики"
            >
              <BarChart2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {isError && (
        <div className="kort-inline-error">
          <AlertCircle size={16} />
          Не удалось загрузить данные аналитики.
        </div>
      )}

      {isLoading && <div className={styles.loadingBar} />}

      {data && (
        <>
          {/* ── Карточки — всегда видны ─────────────────────────────────── */}
          <div className={styles.cards}>
            <StatCard label="Выручка" value={fmt(data.revenue.total)} sub={`Оплачено ${fmt(data.revenue.paid)}`} accent />
            <StatCard label="Заказов" value={String(data.orders.total)} sub={`Ср. чек ${fmt(data.orders.avgAmount)}`} />
            <StatCard label="% Завершения" value={`${data.orders.completionRate.toFixed(1)}%`} sub={`${data.orders.byStatus['completed'] ?? 0} завершено`} />
            <StatCard label="Долг" value={fmt(data.revenue.unpaid)} sub="не оплачено" warn={data.revenue.unpaid > 0} />
          </div>

          {view === 'overview' ? (
            <OverviewTables data={data} />
          ) : (
            <ChartsView data={data} />
          )}
        </>
      )}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent, warn }: {
  label: string; value: string; sub?: string; accent?: boolean; warn?: boolean;
}) {
  return (
    <div className={`${styles.card} ${accent ? styles.cardAccent : ''} ${warn ? styles.cardWarn : ''}`}>
      <div className={styles.cardLabel}>{label}</div>
      <div className={styles.cardValue}>{value}</div>
      {sub && <div className={styles.cardSub}>{sub}</div>}
    </div>
  );
}

// ── Overview (tables) ─────────────────────────────────────────────────────────

function OverviewTables({ data }: { data: NonNullable<ReturnType<typeof useChapanAnalytics>['data']> }) {
  const statusEntries = Object.entries(data.orders.byStatus)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);

  return (
    <div className={styles.tables}>
      {/* Статусы */}
      <div className={styles.tableBlock}>
        <div className={styles.tableTitle}>Заказы по статусам</div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Статус</th>
              <th className={styles.thRight}>Кол-во</th>
              <th className={styles.thRight}>Доля</th>
            </tr>
          </thead>
          <tbody>
            {statusEntries.map(([status, count]) => (
              <tr key={status}>
                <td>
                  <span className={styles.statusDot} style={{ background: STATUS_COLORS[status] ?? '#888' }} />
                  {STATUS_RU[status] ?? status}
                </td>
                <td className={styles.tdRight}>{count}</td>
                <td className={styles.tdRight}>
                  {data.orders.total > 0
                    ? ((count / data.orders.total) * 100).toFixed(1) + '%'
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Менеджеры */}
      {data.managers.length > 0 && (
        <div className={styles.tableBlock}>
          <div className={styles.tableTitle}>Менеджеры</div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Менеджер</th>
                <th className={styles.thRight}>Заказов</th>
                <th className={styles.thRight}>Сумма</th>
                <th className={styles.thRight}>Оплачено</th>
              </tr>
            </thead>
            <tbody>
              {data.managers.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td className={styles.tdRight}>{m.count}</td>
                  <td className={styles.tdRight}>{fmt(m.totalAmount)}</td>
                  <td className={styles.tdRight} style={{ color: m.paidAmount < m.totalAmount ? '#EF4444' : '#10B981' }}>
                    {fmt(m.paidAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Charts view ───────────────────────────────────────────────────────────────

function ChartsView({ data }: { data: NonNullable<ReturnType<typeof useChapanAnalytics>['data']> }) {
  const pieData = Object.entries(data.orders.byStatus)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: STATUS_RU[name] ?? name, value, color: STATUS_COLORS[name] ?? '#888' }));

  const timelineData = data.timeline.map((t) => ({
    date: t.date.slice(5), // MM-DD
    count: t.count,
    revenue: t.revenue,
  }));

  return (
    <div className={styles.charts}>
      {/* Доля по статусам — Pie */}
      {pieData.length > 0 && (
        <div className={styles.chartBlock}>
          <div className={styles.tableTitle}>Доля заказов по статусам</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [`${v} заказов`, '']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Выручка по дням — Bar */}
      {timelineData.length > 0 && (
        <div className={styles.chartBlock}>
          <div className={styles.tableTitle}>Выручка по дням</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={timelineData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} width={64} />
              <Tooltip formatter={(v: number) => [fmt(v), 'Выручка']} />
              <Bar dataKey="revenue" fill="#D0B06A" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Кол-во заказов по дням — Line */}
      {timelineData.length > 0 && (
        <div className={styles.chartBlock}>
          <div className={styles.tableTitle}>Заказы по дням</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={timelineData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
              <Tooltip formatter={(v: number) => [v, 'Заказов']} />
              <Line type="monotone" dataKey="count" stroke="#D0B06A" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Менеджеры — Bar */}
      {data.managers.length > 0 && (
        <div className={styles.chartBlock}>
          <div className={styles.tableTitle}>Выручка по менеджерам</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data.managers.map((m) => ({ name: m.name.split(' ')[0], total: m.totalAmount, paid: m.paidAmount }))}
              margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
            >
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} width={64} />
              <Tooltip formatter={(v: number) => [fmt(v), '']} />
              <Legend />
              <Bar dataKey="total" name="Сумма" fill="#D0B06A" radius={[3, 3, 0, 0]} />
              <Bar dataKey="paid" name="Оплачено" fill="#10B981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
