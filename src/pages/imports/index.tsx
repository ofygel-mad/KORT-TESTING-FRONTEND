import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, ArrowRight, CheckCircle2, FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { successBurst } from '../../shared/motion/presets';
import { api } from '../../shared/api/client';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { setProductMoment } from '../../shared/utils/productMoment';
import { Button } from '../../shared/ui/Button';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Skeleton } from '../../shared/ui/Skeleton';
import s from './Imports.module.css';

const KORT_FIELDS = [
  { value: '', label: 'Не импортировать' },
  { value: 'full_name', label: 'Имя клиента' },
  { value: 'phone', label: 'Телефон' },
  { value: 'email', label: 'Email' },
  { value: 'company_name', label: 'Компания' },
  { value: 'source', label: 'Источник' },
  { value: 'status', label: 'Статус' },
];

interface ImportJob {
  id: string;
  status: string;
  import_type: string;
  preview_json?: {
    headers: string[];
    rows: string[][];
    total: number;
    auto_mapping: Record<string, string>;
  };
  result_json?: {
    success: number;
    errors: number;
    duplicates: number;
  };
  created_at: string;
}

const STEPS = ['Загрузка', 'Маппинг', 'Импорт'];

const STATUS_LABELS: Record<string, string> = {
  uploaded: 'Загружен',
  analyzing: 'Анализ',
  mapping_required: 'Требуется маппинг',
  mapping_confirmed: 'Маппинг подтверждён',
  processing: 'Обработка',
  completed: 'Завершён',
  failed: 'Ошибка',
  pending: 'Ожидание',
};

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  completed: { bg: 'var(--fill-positive-soft)', color: 'var(--fill-positive-text)' },
  failed: { bg: 'var(--fill-negative-soft)', color: 'var(--fill-negative-text)' },
  processing: { bg: 'var(--fill-info-soft)', color: 'var(--fill-info-text)' },
  analyzing: { bg: 'var(--fill-info-soft)', color: 'var(--fill-info-text)' },
  mapping_required: { bg: 'var(--fill-warning-soft)', color: 'var(--fill-warning-text)' },
  mapping_confirmed: { bg: 'var(--fill-accent-soft)', color: 'var(--fill-accent)' },
  uploaded: { bg: 'var(--bg-surface-inset)', color: 'var(--text-secondary)' },
  pending: { bg: 'var(--bg-surface-inset)', color: 'var(--text-secondary)' },
};

function dotClass(idx: number, current: number) {
  return idx < current ? s.done : idx === current ? s.active : s.pending;
}

function numClass(idx: number, current: number) {
  return idx === current ? s.active : s.pending;
}

function connClass(idx: number, current: number) {
  return idx < current ? s.done : s.pending;
}

export default function ImportsPage() {
  useDocumentTitle('Импорт');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [wizardStep, setWizardStep] = useState(0);

  const { data: jobs, isLoading } = useQuery<{ results: ImportJob[] }>({
    queryKey: ['import-jobs'],
    queryFn: () => api.get('/imports/'),
    refetchInterval: (query) => {
      const active = (query.state.data as { results: ImportJob[] } | undefined)?.results.some((job) =>
        ['processing', 'analyzing', 'mapping_required', 'mapping_confirmed'].includes(job.status),
      );
      return active ? 3000 : false;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('import_type', 'customers');
      return api.post<ImportJob>('/imports/', fd as unknown as object);
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] });
      setActiveJobId(job.id);
      setWizardStep(1);
      toast.success('Файл загружен, анализируем структуру...');
    },
    onError: () => toast.error('Не удалось загрузить файл'),
  });

  const startImport = useMutation({
    mutationFn: () => api.post(`/imports/${activeJobId}/start/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['import-jobs'] }),
  });

  const confirmMapping = useMutation({
    mutationFn: () => api.post(`/imports/${activeJobId}/mapping/`, { column_mapping: mapping }),
    onSuccess: () => {
      setWizardStep(2);
      startImport.mutate();
    },
  });

  const activeJob = jobs?.results.find((job) => job.id === activeJobId);
  const preview = activeJob?.preview_json;

  useEffect(() => {
    if (preview?.auto_mapping && Object.keys(mapping).length === 0) {
      setMapping(preview.auto_mapping);
    }
  }, [mapping, preview]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('Поддерживаются только Excel (.xlsx, .xls) и CSV');
      return;
    }
    uploadMutation.mutate(file);
  }

  function resetWizard() {
    setWizardStep(0);
    setActiveJobId(null);
    setMapping({});
  }

  return (
    <div className={s.page}>
      <PageHeader
        title="Импорт данных"
        subtitle="Загрузите клиентскую базу из Excel или CSV и сразу доведите её до рабочего контура"
        actions={<Button variant="secondary" size="sm" onClick={() => navigate(-1)}>Вернуться</Button>}
      />

      <div className={s.wizardCard}>
        <div className={s.wizardIntro}>
          <span className={s.wizardEyebrow}>Import Flow</span>
          <div className={s.wizardTitle}>Загрузите файл и сразу переведите его в рабочий ритм команды</div>
          <div className={s.wizardLead}>
            Kort сначала разбирает колонки, затем даёт быстро подтвердить маппинг и сразу подводит команду к следующему действию.
          </div>
        </div>

        <div className={s.steps}>
          {STEPS.map((label, idx) => (
            <div key={label} className={s.stepItem}>
              <div className={`${s.stepDot} ${dotClass(idx, wizardStep)}`}>
                {idx < wizardStep ? (
                  <CheckCircle2 size={14} className={s.stepDoneIcon} />
                ) : (
                  <span className={`${s.stepNum} ${numClass(idx, wizardStep)}`}>{idx + 1}</span>
                )}
              </div>
              <span className={`${s.stepLabel} ${idx === wizardStep ? s.active : s.other}`}>{label}</span>
              {idx < STEPS.length - 1 && <div className={`${s.stepConnector} ${connClass(idx, wizardStep)}`} />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {wizardStep === 0 && (
            <motion.div key="upload" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className={s.hiddenInput}
                onChange={handleFileChange}
                aria-hidden="true"
              />
              <motion.div
                className={`${s.dropZone} ${uploadMutation.isPending ? s.uploading : ''}`}
                onClick={() => inputRef.current?.click()}
              >
                {uploadMutation.isPending ? (
                  <div className={s.spinnerWrap}>
                    <div className={s.spinner} />
                    <span className={s.spinnerLabel}>Загружаем и разбираем файл...</span>
                  </div>
                ) : (
                  <>
                    <Upload size={32} className={s.dropIcon} />
                    <div className={s.dropTitle}>Перетащите файл или выберите его вручную</div>
                    <div className={s.dropDesc}>Поддерживаются .xlsx, .xls и .csv</div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}

          {wizardStep === 1 && preview && (
            <motion.div key="mapping" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className={s.mappingHeader}>
                <div>
                  <div className={s.mappingTitle}>Сопоставление колонок</div>
                  <div className={s.mappingCount}>Всего строк: {preview.total}</div>
                </div>
                <div className={s.mappingActions}>
                  <Button variant="secondary" size="sm" onClick={resetWizard}>Заново</Button>
                  <Button
                    size="sm"
                    loading={confirmMapping.isPending}
                    iconRight={<ArrowRight size={13} />}
                    onClick={() => confirmMapping.mutate()}
                  >
                    Импортировать
                  </Button>
                </div>
              </div>

              <div className={s.mappingGrid}>
                {preview.headers.map((header) => (
                  <div key={header} className={s.mappingRow}>
                    <span className={s.mappingColName}>{header}</span>
                    <ArrowRight size={12} className={s.mappingArrow} />
                    <select
                      aria-label={`Поле для колонки: ${header}`}
                      value={mapping[header] ?? ''}
                      onChange={(event) => setMapping((prev) => ({ ...prev, [header]: event.target.value }))}
                      className={`kort-input ${s.mappingSelect}`}
                    >
                      {KORT_FIELDS.map((field) => (
                        <option key={field.value} value={field.value}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className={s.previewLabel}>Предварительный просмотр первых пяти строк</div>
              <div className={s.previewTableWrap}>
                <table className={s.previewTable}>
                  <thead>
                    <tr>
                      {preview.headers.map((header) => (
                        <th key={header} className={s.previewTh}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 5).map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className={s.previewTd}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {wizardStep === 2 && (
            <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {activeJob?.status === 'processing' ? (
                <motion.div className={s.resultCenter} variants={successBurst} initial="hidden" animate="visible">
                  <div className={s.resultSpinner} />
                  <div className={s.resultProcessingTitle}>Импортируем клиентов...</div>
                  <div className={s.resultProcessingDesc}>Результат обновится автоматически</div>
                </motion.div>
              ) : activeJob?.status === 'completed' ? (
                <motion.div className={s.resultCenter} variants={successBurst} initial="hidden" animate="visible">
                  <CheckCircle2 size={40} className={s.resultSuccessIcon} />
                  <div className={s.resultSuccessTitle}>Импорт завершён</div>
                  <div className={s.statsRow}>
                    {[
                      { label: 'Успешно', value: activeJob.result_json?.success ?? 0, tone: s.statPositive },
                      { label: 'Дублей', value: activeJob.result_json?.duplicates ?? 0, tone: s.statWarning },
                      { label: 'Ошибок', value: activeJob.result_json?.errors ?? 0, tone: s.statNegative },
                    ].map((stat) => (
                      <div key={stat.label} className={s.statItem}>
                        <div className={`${s.statValue} ${stat.tone}`}>{stat.value}</div>
                        <div className={s.statLabel}>{stat.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className={s.resultActions}>
                    <Button className={s.resultNewImport} onClick={resetWizard}>Новый импорт</Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setProductMoment('Импорт завершён. Сначала проверьте карточки клиентов, затем сразу соберите первые активные сделки.');
                        navigate('/customers');
                      }}
                    >
                      Открыть клиентов
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setProductMoment('Импорт завершён. Kort Home уже подготовлен как следующий контур действий: проверить базу, собрать сделки и раздать задачи.');
                        navigate('/');
                      }}
                    >
                      Перейти в Kort Home
                    </Button>
                  </div>
                  <div className={s.nextActionRail}>
                    <div className={s.nextActionTitle}>Что делать дальше</div>
                    <div className={s.nextActionGrid}>
                      <button
                        className={s.nextActionCard}
                        onClick={() => {
                          setProductMoment('Импорт завершён. Проверьте клиентов сразу после загрузки, пока контекст ещё горячий.');
                          navigate('/customers');
                        }}
                      >
                        Проверить карточки клиентов
                      </button>
                      <button
                        className={s.nextActionCard}
                        onClick={() => {
                          setProductMoment('Импорт завершён. Переходите к сделкам, пока свежие клиенты ещё не остыли в системе.');
                          navigate('/deals');
                        }}
                      >
                        Создать первую сделку
                      </button>
                      <button
                        className={s.nextActionCard}
                        onClick={() => {
                          setProductMoment('Импорт завершён. Возвращайтесь в обзор команды, чтобы увидеть следующий операционный шаг.');
                          navigate('/');
                        }}
                      >
                        Вернуться в обзор команды
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className={s.resultError}>
                  <AlertCircle size={32} className={s.resultErrorIcon} />
                  <div className={s.resultErrorTitle}>Импорт не завершился</div>
                  <div className={s.resultErrorText}>
                    Проверьте файл и сопоставление полей, затем повторите попытку без потери текущего сценария.
                  </div>
                  <div className={s.resultErrorActions}>
                    <button className={s.resultRecoveryBtn} onClick={() => setWizardStep(0)}>Исправить и повторить</button>
                    <button className={s.resultRecoveryBtn} onClick={resetWizard}>Начать заново</button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={s.historyCard}>
        <div className={s.historyTitle}>История импортов</div>

        {isLoading
          ? [1, 2, 3].map((item) => (
              <div key={item} className={s.historySkeletonRow}>
                <Skeleton height={14} width="50%" />
              </div>
            ))
          : (jobs?.results ?? []).length === 0
            ? <div className={s.historyEmpty}>Импортов пока не было</div>
            : (jobs?.results ?? []).map((job) => {
                const badge = STATUS_BADGE[job.status] ?? STATUS_BADGE.pending;
                return (
                  <div key={job.id} className={s.historyRow}>
                    <div className={s.historyRowLeft}>
                      <FileText size={14} className={s.historyIcon} />
                      <div>
                        <div className={s.historyJobName}>Импорт клиентов</div>
                        <div className={s.historyJobDate}>
                          {new Date(job.created_at).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                    <div
                      className={s.statusBadge}
                      style={{ '--status-bg': badge.bg, '--status-color': badge.color } as CSSProperties}
                    >
                      {STATUS_LABELS[job.status] ?? job.status}
                    </div>
                  </div>
                );
              })}
      </div>
    </div>
  );
}
