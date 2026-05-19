import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, FileSpreadsheet, Pencil, Plus, RefreshCw, Save, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { adsApi } from '@/entities/ads/api';
import { readApiErrorMessage } from '../../shared/api/errors';
import {
  useAdsDashboard,
  useCreateAdCampaign,
  useDeleteAdCampaign,
  useRefreshUsdKztRate,
  useUpdateAdCampaign,
  useUpsertAdMetric,
} from '@/entities/ads/queries';
import type { AdCampaignReport, AdChannel, AdDailyMetric, AdSummary } from '@/entities/ads/types';
import { Skeleton } from '../../shared/ui/Skeleton';
import styles from './Reports.module.css';

const CHANNELS: Array<{ value: AdChannel; label: string }> = [
  { value: 'target', label: 'Таргет' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'partner', label: 'Серіктес' },
  { value: 'other', label: 'Другое' },
];

function currentPeriod() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function firstDay(period: string) {
  return `${period}-01`;
}

function fmtMoneyKzt(n: number) {
  return new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n) + ' тг';
}

function fmtPct(n: number) {
  return new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 1 }).format(n * 100) + '%';
}

function fmtNum(n: number) {
  return new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n);
}

function toNumber(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').replace(',', '.').trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function metricForDate(campaign: AdCampaignReport | undefined, date: string): AdDailyMetric | undefined {
  return campaign?.metrics.find((metric) => metric.date.slice(0, 10) === date);
}

function TotalsStrip({ summary }: { summary: AdSummary }) {
  return (
    <div className={styles.adsTotalsStrip}>
      <div>
        <span>Бюджет</span>
        <strong>{fmtMoneyKzt(summary.spendKzt)}</strong>
      </div>
      <div>
        <span>Показы</span>
        <strong>{fmtNum(summary.impressions)}</strong>
      </div>
      <div>
        <span>Клики / CTR (Коэффициент кликабельности)</span>
        <strong>{fmtNum(summary.clicks)} · {fmtPct(summary.ctr)}</strong>
      </div>
      <div>
        <span>Лиды / CPL (Стоимость за лида)</span>
        <strong>{fmtNum(summary.leads)} · {fmtMoneyKzt(summary.cplKzt)}</strong>
      </div>
      <div>
        <span>Продажи / клиент</span>
        <strong>{fmtNum(summary.sales)} · {fmtMoneyKzt(summary.customerCostKzt)}</strong>
      </div>
    </div>
  );
}

function CampaignForm({ channel }: { channel: AdChannel }) {
  const createCampaign = useCreateAdCampaign();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const el = event.currentTarget;
    const form = new FormData(el);
    const name = String(form.get('name') ?? '').trim();
    if (!name) return;

    createCampaign.mutate(
      {
        name,
        channel,
        managerName: String(form.get('managerName') ?? '').trim() || undefined,
        creativeUrl: String(form.get('creativeUrl') ?? '').trim() || undefined,
      },
      { onSuccess: () => el.reset() },
    );
  }

  return (
    <form className={styles.adsForm} onSubmit={handleSubmit}>
      <div className={styles.adsFormInputs}>
        <input className={styles.adsInput} name="name" placeholder="Название кампании или креатива *" required />
        <input className={styles.adsInput} name="managerName" placeholder="Менеджер" />
        <input className={styles.adsInput} name="creativeUrl" placeholder="Ссылка на креатив" />
      </div>
      <div className={styles.adsFormActions}>
        <button className={styles.adsPrimaryButton} type="submit" disabled={createCampaign.isPending}>
          <Plus size={14} /> Создать кампанию
        </button>
      </div>
    </form>
  );
}

function MetricEditor({
  campaign,
  period,
  defaultRate,
}: {
  campaign: AdCampaignReport | undefined;
  period: string;
  defaultRate: number;
}) {
  const [date, setDate] = useState(firstDay(period));
  const upsertMetric = useUpsertAdMetric();
  const metric = metricForDate(campaign, date);

  useEffect(() => {
    setDate(firstDay(period));
  }, [period, campaign?.id]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLInputElement;
      if (target.type === 'number') {
        e.preventDefault();
      }
    };

    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => document.removeEventListener('wheel', handleWheel);
  }, []);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaign) return;

    const form = new FormData(event.currentTarget);
    upsertMetric.mutate({
      campaignId: campaign.id,
      date,
      spendUsd: toNumber(form.get('spendUsd')),
      exchangeRate: toNumber(form.get('exchangeRate')) || defaultRate,
      impressions: toNumber(form.get('impressions')),
      reach: toNumber(form.get('reach')),
      clicks: toNumber(form.get('clicks')),
      leads: toNumber(form.get('leads')),
      sales: toNumber(form.get('sales')),
      notes: String(form.get('notes') ?? '').trim() || undefined,
    });
  }

  if (!campaign) {
    return (
      <div className={styles.empty}>
        <p>Добавьте или выберите кампанию, чтобы заполнять ежедневные показатели.</p>
      </div>
    );
  }

  return (
    <div className={styles.tableCard}>
      <div className={styles.tableCardHeader}>
        <span className={styles.tableCardTitle}>Дневной ввод: {campaign.name}</span>
      </div>
      <form className={styles.adsMetricForm} onSubmit={handleSubmit} key={`${campaign.id}-${date}-${metric?.id ?? 'new'}`}>
        <label className={styles.adsField}>
          <span>Дата</span>
          <input className={styles.adsInput} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className={styles.adsField}>
          <span>Бюджет $</span>
          <input className={styles.adsInput} name="spendUsd" type="number" step="0.01" placeholder="0.00" defaultValue={metric ? metric.spendUsd : ''} />
        </label>
        <label className={styles.adsField}>
          <span>Курс USD/KZT</span>
          <input className={styles.adsInput} name="exchangeRate" type="number" step="0.01" defaultValue={metric?.exchangeRate || defaultRate} />
        </label>
        <label className={styles.adsField}>
          <span>Показы</span>
          <input className={styles.adsInput} name="impressions" type="number" placeholder="0" defaultValue={metric ? metric.impressions : ''} />
        </label>
        <label className={styles.adsField}>
          <span>Охват</span>
          <input className={styles.adsInput} name="reach" type="number" placeholder="0" defaultValue={metric ? metric.reach : ''} />
        </label>
        <label className={styles.adsField}>
          <span>Клики</span>
          <input className={styles.adsInput} name="clicks" type="number" placeholder="0" defaultValue={metric ? metric.clicks : ''} />
        </label>
        <label className={styles.adsField}>
          <span>Лиды</span>
          <input className={styles.adsInput} name="leads" type="number" placeholder="0" defaultValue={metric ? metric.leads : ''} />
        </label>
        <label className={styles.adsField}>
          <span>Продажи</span>
          <input className={styles.adsInput} name="sales" type="number" placeholder="0" defaultValue={metric ? metric.sales : ''} />
        </label>
        <label className={styles.adsFieldWide}>
          <span>Комментарий</span>
          <input className={styles.adsInput} name="notes" defaultValue={metric?.notes ?? ''} />
        </label>
        <button className={styles.adsPrimaryButton} type="submit" disabled={upsertMetric.isPending}>
          <Save size={14} /> Сохранить день
        </button>
      </form>
    </div>
  );
}

function CampaignTable({
  campaigns,
  selectedCampaignId,
  editingCampaignId,
  confirmDeleteId,
  exportSelectedIds,
  onSelect,
  onEdit,
  onConfirmDelete,
  onDelete,
  onToggleExportSelect,
}: {
  campaigns: AdCampaignReport[];
  selectedCampaignId?: string;
  editingCampaignId?: string;
  confirmDeleteId?: string;
  exportSelectedIds: Set<string>;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onConfirmDelete: (id: string | undefined) => void;
  onDelete: (id: string) => void;
  onToggleExportSelect: (id: string) => void;
}) {
  const isAllSelected = campaigns.length > 0 && campaigns.every((c) => exportSelectedIds.has(c.id));

  function handleSelectAll() {
    if (isAllSelected) {
      exportSelectedIds.forEach((id) => onToggleExportSelect(id));
    } else {
      campaigns.forEach((c) => {
        if (!exportSelectedIds.has(c.id)) {
          onToggleExportSelect(c.id);
        }
      });
    }
  }
  return (
    <div className={styles.tableCard}>
      <div className={styles.tableCardHeader}>
        <span className={styles.tableCardTitle}>Кампании и креативы</span>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.adsCheckboxColumn}>
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleSelectAll}
                title="Выбрать все кампании для экспорта"
                className={styles.adsCheckbox}
              />
            </th>
            <th>Кампания</th>
            <th>Менеджер</th>
            <th style={{ textAlign: 'right' }}>Бюджет</th>
            <th style={{ textAlign: 'right' }}>Клики</th>
            <th style={{ textAlign: 'right' }}>Лиды</th>
            <th style={{ textAlign: 'right' }}>CPL (Стоимость за лида)</th>
            <th aria-label="Действия" />
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr
              key={campaign.id}
              className={`${styles.row} ${selectedCampaignId === campaign.id ? styles.adsSelectedRow : ''}`}
              onClick={() => onSelect(campaign.id)}
            >
              <td className={styles.adsCheckboxColumn} onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={exportSelectedIds.has(campaign.id)}
                  onChange={() => onToggleExportSelect(campaign.id)}
                  className={styles.adsCheckbox}
                />
              </td>
              <td className={styles.tdName}>{campaign.name}</td>
              <td>{campaign.managerName || '—'}</td>
              <td style={{ textAlign: 'right' }}>{fmtMoneyKzt(campaign.summary.spendKzt)}</td>
              <td style={{ textAlign: 'right' }}>{fmtNum(campaign.summary.clicks)}</td>
              <td style={{ textAlign: 'right' }}>{fmtNum(campaign.summary.leads)}</td>
              <td style={{ textAlign: 'right' }}>{fmtMoneyKzt(campaign.summary.cplKzt)}</td>
              <td onClick={(e) => e.stopPropagation()}>
                <div className={styles.adsRowActions}>
                  {confirmDeleteId === campaign.id ? (
                    <>
                      <button
                        className={styles.adsDangerButton}
                        type="button"
                        onClick={() => onDelete(campaign.id)}
                      >
                        Удалить?
                      </button>
                      <button
                        className={styles.adsIconButton}
                        type="button"
                        title="Отмена"
                        onClick={() => onConfirmDelete(undefined)}
                      >
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className={`${styles.adsIconButton} ${editingCampaignId === campaign.id ? styles.adsIconButtonActive : ''}`}
                        type="button"
                        title="Редактировать"
                        onClick={() => onEdit(campaign.id)}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className={styles.adsIconButton}
                        type="button"
                        title="Удалить"
                        onClick={() => onConfirmDelete(campaign.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {campaigns.length === 0 && (
        <div className={styles.empty}>
          <p>Пока нет кампаний для выбранного канала.</p>
        </div>
      )}
    </div>
  );
}

function CampaignEditForm({
  campaign,
  onDone,
}: {
  campaign: AdCampaignReport;
  onDone: () => void;
}) {
  const updateCampaign = useUpdateAdCampaign();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    updateCampaign.mutate(
      {
        id: campaign.id,
        name: String(form.get('name') ?? '').trim() || campaign.name,
        managerName: String(form.get('managerName') ?? '').trim() || null,
        creativeUrl: String(form.get('creativeUrl') ?? '').trim() || null,
      },
      { onSuccess: onDone },
    );
  }

  return (
    <div className={styles.tableCard}>
      <div className={styles.tableCardHeader}>
        <span className={styles.tableCardTitle}>Редактирование: {campaign.name}</span>
      </div>
      <form className={styles.adsForm} onSubmit={handleSubmit}>
        <div className={styles.adsFormInputs}>
          <input className={styles.adsInput} name="name" defaultValue={campaign.name} placeholder="Название кампании *" required />
          <input className={styles.adsInput} name="managerName" defaultValue={campaign.managerName ?? ''} placeholder="Менеджер" />
          <input className={styles.adsInput} name="creativeUrl" defaultValue={campaign.creativeUrl ?? ''} placeholder="Ссылка на креатив" />
        </div>
        <div className={styles.adsFormActions}>
          <button className={styles.adsGhostButton} type="button" onClick={onDone}>
            <X size={14} /> Отмена
          </button>
          <button className={styles.adsPrimaryButton} type="submit" disabled={updateCampaign.isPending}>
            <Save size={14} /> Сохранить
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdsReport() {
  const [period, setPeriod] = useState(currentPeriod());
  const [channel, setChannel] = useState<AdChannel>('target');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>();
  const [editingCampaignId, setEditingCampaignId] = useState<string>();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string>();
  const [exportSelectedIds, setExportSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const dashboard = useAdsDashboard({ period, channel });
  const refreshRate = useRefreshUsdKztRate();
  const deleteCampaign = useDeleteAdCampaign();
  const campaigns = dashboard.data?.campaigns ?? [];
  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0],
    [campaigns, selectedCampaignId],
  );
  const editingCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === editingCampaignId),
    [campaigns, editingCampaignId],
  );

  function handleEditCampaign(id: string) {
    setEditingCampaignId((prev) => (prev === id ? undefined : id));
    setConfirmDeleteId(undefined);
  }

  function handleDeleteCampaign(id: string) {
    deleteCampaign.mutate(id, {
      onSuccess: () => {
        if (selectedCampaignId === id) setSelectedCampaignId(undefined);
        if (editingCampaignId === id) setEditingCampaignId(undefined);
        setConfirmDeleteId(undefined);
      },
    });
  }

  useEffect(() => {
    if (!selectedCampaignId && campaigns[0]) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaigns, selectedCampaignId]);

  async function handleExport() {
    setIsExporting(true);
    try {
      const XLSX = await import('xlsx');
      const payload = await adsApi.exportRows({ period, channel });
      const summary = dashboard.data?.summary;
      const workbook = XLSX.utils.book_new();

      // Summary sheet with Russian headers - recalculate for selected campaigns if needed
      let summaryToExport = summary;
      if (exportSelectedIds.size > 0) {
        const selectedCampaigns = campaigns.filter((c) => exportSelectedIds.has(c.id));
        const selectedSummary = selectedCampaigns.reduce(
          (acc, c) => ({
            spendUsd: acc.spendUsd + c.summary.spendUsd,
            spendKzt: acc.spendKzt + c.summary.spendKzt,
            impressions: acc.impressions + c.summary.impressions,
            clicks: acc.clicks + c.summary.clicks,
            leads: acc.leads + c.summary.leads,
            sales: acc.sales + c.summary.sales,
            ctr: acc.impressions > 0 ? acc.clicks / acc.impressions : 0,
            cplKzt: acc.leads > 0 ? acc.spendKzt / acc.leads : 0,
            customerCostKzt: acc.sales > 0 ? acc.spendKzt / acc.sales : 0,
          }),
          { spendUsd: 0, spendKzt: 0, impressions: 0, clicks: 0, leads: 0, sales: 0, ctr: 0, cplKzt: 0, customerCostKzt: 0 },
        );
        summaryToExport = selectedSummary as any;
      }

      const summaryData = [
        {
          'Период': `${period}-01`,
          'Канал': channel,
          'Расход USD': summaryToExport?.spendUsd ?? 0,
          'Расход KZT': fmtMoneyKzt(summaryToExport?.spendKzt ?? 0),
          'Показы': fmtNum(summaryToExport?.impressions ?? 0),
          'Клики': fmtNum(summaryToExport?.clicks ?? 0),
          'Лиды': fmtNum(summaryToExport?.leads ?? 0),
          'Продажи': fmtNum(summaryToExport?.sales ?? 0),
          'CTR (Коэффициент кликабельности)': summaryToExport ? fmtPct(summaryToExport.ctr) : '0%',
          'CPL/Стоимость за лида (KZT)': fmtMoneyKzt(summaryToExport?.cplKzt ?? 0),
          'Стоимость клиента': fmtMoneyKzt(summaryToExport?.customerCostKzt ?? 0),
        },
      ];

      // Daily metrics sheet with Russian headers - filter by selected campaigns if any are selected
      const filteredRows = exportSelectedIds.size > 0
        ? payload.rows.filter((row: any) => exportSelectedIds.has(row.campaignId))
        : payload.rows;

      const dailyData = filteredRows.map((row: any) => ({
        'Дата': row.date,
        'Кампания': row.campaignName,
        'Менеджер': row.managerName || '—',
        'Расход USD': row.spendUsd,
        'Курс': row.exchangeRate.toFixed(2),
        'Расход KZT': fmtMoneyKzt(row.spendKzt),
        'Показы': fmtNum(row.impressions),
        'Охват': fmtNum(row.reach),
        'Клики': fmtNum(row.clicks),
        'Лиды': fmtNum(row.leads),
        'Продажи': fmtNum(row.sales),
        'Комментарий': row.notes || '',
      }));

      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      const dailySheet = XLSX.utils.json_to_sheet(dailyData);

      // Format header row and column widths for summary sheet
      summarySheet['!cols'] = [
        { wch: 14 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 28 },
        { wch: 28 },
        { wch: 18 },
      ];

      // Format header row and column widths for daily sheet
      dailySheet['!cols'] = [
        { wch: 12 },
        { wch: 18 },
        { wch: 14 },
        { wch: 12 },
        { wch: 10 },
        { wch: 14 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 20 },
      ];

      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Итог');
      XLSX.utils.book_append_sheet(workbook, dailySheet, 'Дневные данные');
      XLSX.writeFile(workbook, `rnp_ads_${period}_${channel}.xlsx`);
      toast.success('Excel файл скачан успешно');
    } catch (err) {
      toast.error(readApiErrorMessage(err, 'Не удалось экспортировать данные'));
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImportStub() {
    const response = await adsApi.importPreviewStub();
    toast.message(response.message);
  }

  return (
    <div className={styles.reportSection}>
      <div className={styles.adsToolbar}>
        <label className={styles.adsField}>
          <span>Период</span>
          <input className={styles.adsInput} type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
        </label>
        <label className={styles.adsField}>
          <span>Канал</span>
          <select className={styles.adsInput} value={channel} onChange={(event) => setChannel(event.target.value as AdChannel)}>
            {CHANNELS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <button className={styles.adsGhostButton} type="button" onClick={() => refreshRate.mutate(firstDay(period))}>
          <RefreshCw size={14} /> Обновить курс
        </button>
        <button className={styles.adsGhostButton} type="button" onClick={handleImportStub}>
          <Upload size={14} /> Импорт Excel
        </button>
        <button className={styles.adsPrimaryButton} type="button" onClick={handleExport} disabled={isExporting}>
          <FileSpreadsheet size={14} /> {isExporting ? 'Формирую Excel...' : 'Скачать Excel'}
        </button>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableCardHeader}>
          <span className={styles.tableCardTitle}>Новая кампания</span>
        </div>
        <CampaignForm channel={channel} />
      </div>

      {dashboard.isLoading ? (
        <Skeleton height={220} radius={10} />
      ) : dashboard.data ? (
        <>
          <div className={styles.adsRateBar}>
            <CalendarDays size={16} />
            <span>
              Официальный курс NBK: 1 USD = {dashboard.data.exchangeRate.rate.toFixed(2)} KZT
              {' '}на {dashboard.data.exchangeRate.rateDate.slice(0, 10)}
              {dashboard.data.exchangeRate.isFallback ? ' · использован последний доступный курс' : ''}
            </span>
          </div>

          <TotalsStrip summary={dashboard.data.summary} />

          <CampaignTable
            campaigns={campaigns}
            selectedCampaignId={selectedCampaign?.id}
            editingCampaignId={editingCampaignId}
            confirmDeleteId={confirmDeleteId}
            exportSelectedIds={exportSelectedIds}
            onSelect={setSelectedCampaignId}
            onEdit={handleEditCampaign}
            onConfirmDelete={setConfirmDeleteId}
            onDelete={handleDeleteCampaign}
            onToggleExportSelect={(id) => {
              const newSet = new Set(exportSelectedIds);
              if (newSet.has(id)) newSet.delete(id);
              else newSet.add(id);
              setExportSelectedIds(newSet);
            }}
          />

          {editingCampaign && (
            <CampaignEditForm
              campaign={editingCampaign}
              onDone={() => setEditingCampaignId(undefined)}
            />
          )}

          <MetricEditor
            campaign={selectedCampaign}
            period={period}
            defaultRate={dashboard.data.exchangeRate.rate}
          />
        </>
      ) : (
        <div className={styles.empty}>
          <p>Не удалось загрузить данные рекламного кабинета.</p>
          <button
            className={styles.adsGhostButton}
            type="button"
            onClick={() => dashboard.refetch()}
          >
            <RefreshCw size={14} /> Попробовать снова
          </button>
        </div>
      )}
    </div>
  );
}
