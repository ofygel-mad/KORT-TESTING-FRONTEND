import { useEffect, useRef, useState, useCallback, useMemo, type CSSProperties, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { overlayVariants, commandInvoke } from '../../shared/motion/presets';
import { useNavigate } from 'react-router-dom';
import {
  Search, Users, Briefcase, CheckSquare, Settings,
  BarChart2, Zap, Upload, Clock, Loader2,
  ArrowRight, Plus, MessageSquare, Sparkles, Command, Wand2, CornerDownLeft, X,
} from 'lucide-react';
import { useCommandPalette } from '../../shared/stores/commandPalette';
import { useUIStore } from '../../shared/stores/ui';
import { api } from '../../shared/api/client';
import { readStorage, writeStorage } from '../../shared/lib/browser';
import { useCapabilities } from '../../shared/hooks/useCapabilities';
import styles from './CommandPalette.module.css';

interface Result {
  id: string;
  type: 'customer' | 'deal' | 'task' | 'nav' | 'action' | 'recent';
  label: string;
  sub?: string;
  path?: string;
  icon: ReactNode;
  color?: string;
  meta?: any;
  action: () => void;
}

const NAV_COMMANDS = [
  { id: 'go-customers', label: 'Клиенты', sub: 'Перейти', icon: <Users size={14} />, path: '/crm/customers' },
  { id: 'go-deals', label: 'Сделки', sub: 'Перейти', icon: <Briefcase size={14} />, path: '/crm/deals' },
  { id: 'go-tasks', label: 'Задачи', sub: 'Перейти', icon: <CheckSquare size={14} />, path: '/crm/tasks' },
  { id: 'go-templates', label: 'Шаблоны сообщений', sub: 'Перейти', icon: <MessageSquare size={14} />, path: '/settings/templates' },
  { id: 'go-reports', label: 'Отчёты', sub: 'Перейти', icon: <BarChart2 size={14} />, path: '/reports' },
  { id: 'go-settings', label: 'Настройки', sub: 'Перейти', icon: <Settings size={14} />, path: '/settings' },
  { id: 'go-import', label: 'Импорт', sub: 'Перейти', icon: <Upload size={14} />, path: '/crm/customers' },
];

const RECENT_KEY = 'kort:recent-items';
const MAX_RECENT = 5;

function getRecent(): Result[] {
  try {
    return JSON.parse(readStorage(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function pushRecent(item: Omit<Result, 'action'>) {
  const prev = getRecent().filter((r) => r.id !== item.id);
  writeStorage(RECENT_KEY, JSON.stringify([item, ...prev].slice(0, MAX_RECENT)));
}

function useDebounce<T>(value: T, ms: number): T {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return dv;
}

function filterChipVars(type: string): CSSProperties {
  if (type === 'customer') return { '--chip-bg': 'var(--fill-info-soft)', '--chip-color': 'var(--fill-info-text)' } as CSSProperties;
  if (type === 'deal') return { '--chip-bg': 'var(--fill-warning-soft)', '--chip-color': 'var(--fill-warning-text)' } as CSSProperties;
  return { '--chip-bg': 'var(--fill-accent-soft)', '--chip-color': 'var(--text-accent)' } as CSSProperties;
}

function resultIconVars(type: Result['type'], color?: string): CSSProperties {
  if (color) return { '--result-icon-bg': 'color-mix(in srgb, ' + color + ' 16%, var(--bg-surface-inset))', '--result-icon-color': color } as CSSProperties;
  if (type === 'customer') return { '--result-icon-bg': 'var(--fill-info-soft)', '--result-icon-color': 'var(--fill-info-text)' } as CSSProperties;
  if (type === 'deal') return { '--result-icon-bg': 'var(--fill-warning-soft)', '--result-icon-color': 'var(--fill-warning-text)' } as CSSProperties;
  if (type === 'task') return { '--result-icon-bg': 'var(--fill-accent-soft)', '--result-icon-color': 'var(--text-accent)' } as CSSProperties;
  return { '--result-icon-bg': 'var(--bg-surface-inset)', '--result-icon-color': 'var(--text-tertiary)' } as CSSProperties;
}

export function CommandPalette() {
  const { close } = useCommandPalette();
  const ui = useUIStore();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { canManageTeam, canViewAudit, canRunAutomations, can, hasCompanyAccess } = useCapabilities();

  const [query, setQuery] = useState('');
  const [apiRes, setApiRes] = useState<Result[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const dq = useDebounce(query.trim(), 200);

  const actionCommands = useMemo(() => ([
    { id: 'new-customer', label: 'Новый клиент', icon: <Plus size={14} />, color: 'var(--fill-info-text)', visible: can('customers:write'), action: () => { navigate('/crm/customers'); close(); } },
    { id: 'new-deal', label: 'Новая сделка', icon: <Plus size={14} />, color: 'var(--fill-warning-text)', visible: can('deals:write'), action: () => { navigate('/crm/deals'); close(); } },
    { id: 'new-task', label: 'Новая задача', icon: <Plus size={14} />, color: 'var(--text-accent)', visible: can('tasks:write'), action: () => { navigate('/crm/tasks'); close(); } },
    { id: 'open-import', label: 'Открыть импорт', icon: <Upload size={14} />, color: 'var(--text-secondary)', visible: can('customers.import'), action: () => navigate('/crm/customers') },
  ].filter((item) => item.visible)), [can, navigate, ui]);

  const { cleanQuery, filterType } = useMemo(() => {
    const prefixMatch = query.match(/^@(customer|deal|task)\s*(.*)/i);
    if (prefixMatch) return { cleanQuery: prefixMatch[2], filterType: prefixMatch[1].toLowerCase() };
    return { cleanQuery: query, filterType: '' };
  }, [query]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [close]);

  useEffect(() => {
    const effectiveQ = cleanQuery.trim();
    if (!hasCompanyAccess || !effectiveQ || effectiveQ.length < 2 || query.startsWith('/')) {
      setApiRes([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    api.get('/search/', {
      q: effectiveQ,
      limit: '8',
      ...(filterType ? { types: filterType } : {}),
    })
      .then((data: any) => {
        if (cancelled) return;
        const results: Result[] = (data.results ?? []).map((r: any) => {
          const route = r.type === 'customer' ? '/crm/customers'
                      : r.type === 'deal'     ? '/crm/deals'
                      : r.type === 'task'     ? '/crm/tasks'
                      : r.path;
          return {
            id: `api-${r.type}-${r.id}`,
            type: r.type,
            label: r.label,
            sub: r.sublabel,
            path: route,
            meta: r.meta,
            icon: r.type === 'customer' ? <Users size={14} /> : r.type === 'deal' ? <Briefcase size={14} /> : <CheckSquare size={14} />,
            color: r.type === 'customer' ? 'var(--fill-info-text)' : r.type === 'deal' ? 'var(--fill-warning-text)' : 'var(--text-accent)',
            action: () => {
              pushRecent({
                id: `api-${r.type}-${r.id}`,
                type: r.type,
                label: r.label,
                sub: r.sublabel,
                path: route,
                icon: null,
                color: undefined,
                meta: r.meta,
              });
              navigate(route);
            },
          };
        });
        setApiRes(results);
      })
      .catch(() => setApiRes([]))
      .finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [dq, cleanQuery, query, filterType, hasCompanyAccess, navigate]);

  const results: (Result & { _section?: string })[] = [];
  const isSlash = query.startsWith('/');
  const slashMatch = isSlash ? query.slice(1).toLowerCase() : '';
  const slashMap = [
    { keys: ['клиент', 'client', 'customer', 'new-customer', 'к'], visible: can('customers:write'), label: 'Создать клиента', color: 'var(--fill-info-text)', action: () => { navigate('/crm/customers'); close(); } },
    { keys: ['сделка', 'deal', 'new-deal', 'с'], visible: can('deals:write'), label: 'Создать сделку', color: 'var(--fill-warning-text)', action: () => { navigate('/crm/deals'); close(); } },
    { keys: ['задача', 'task', 'new-task', 'з'], visible: can('tasks:write'), label: 'Создать задачу', color: 'var(--text-accent)', action: () => { navigate('/crm/tasks'); close(); } },
    { keys: ['импорт', 'import', 'и'], visible: can('customers.import'), label: 'Открыть импорт', color: 'var(--text-secondary)', action: () => navigate('/crm/customers') },
    { keys: ['copilot', 'ai', 'ассистент'], visible: true, label: 'Спросить ассистента', color: 'var(--fill-positive-text)', action: () => ui.openAssistantPrompt('Какой следующий шаг по текущему контексту?') },
  ].filter((item) => item.visible);

  if (!query) {
    const recent = getRecent();
    if (recent.length > 0) {
      recent.forEach((r, i) => results.push({
        ...r,
        _section: i === 0 ? 'Недавние' : undefined,
        icon: r.type === 'customer' ? <Users size={14} /> : r.type === 'deal' ? <Briefcase size={14} /> : r.type === 'task' ? <CheckSquare size={14} /> : <Clock size={14} />,
        action: r.action ?? (() => navigate(r.path ?? '/')),
      }));
    }

    actionCommands.forEach((a, i) => results.push({
      id: a.id,
      type: 'action',
      label: a.label,
      icon: a.icon,
      color: a.color,
      _section: i === 0 ? 'Действия' : undefined,
      action: () => { a.action(); close(); },
    }));

    NAV_COMMANDS.filter((n) => {
      if (n.id === 'go-import') return can('customers.import');
      return true;
    }).forEach((n, i) => results.push({
      id: n.id,
      type: 'nav',
      label: n.label,
      sub: n.sub,
      icon: n.icon,
      _section: i === 0 ? 'Навигация' : undefined,
      action: () => { navigate(n.path); close(); },
    }));
  } else if (isSlash) {
    const matched = slashMap.filter((entry) => entry.keys.some((key) => key.startsWith(slashMatch) || slashMatch === ''));
    matched.forEach((entry, i) => results.push({
      id: `slash-${entry.keys[0]}`,
      type: 'action',
      label: entry.label,
      sub: `/${entry.keys[0]}`,
      icon: <Zap size={14} />,
      color: entry.color,
      _section: i === 0 ? 'Быстрые команды' : undefined,
      action: () => { entry.action(); close(); },
    }));
  } else {
    apiRes.forEach((r, i) => results.push({ ...r, _section: i === 0 ? 'Результаты' : undefined }));

    NAV_COMMANDS.filter((n) => n.label.toLowerCase().includes(query.toLowerCase())).filter((n) => {
      if (n.id === 'go-import') return can('customers.import');
      return true;
    }).forEach((n, i) => results.push({
      id: n.id,
      type: 'nav',
      label: n.label,
      sub: n.sub,
      icon: n.icon,
      _section: apiRes.length === 0 && i === 0 ? 'Навигация' : undefined,
      action: () => { navigate(n.path); close(); },
    }));

    actionCommands.filter((a) => a.label.toLowerCase().includes(query.toLowerCase())).forEach((a, i) => results.push({
      id: a.id,
      type: 'action',
      label: a.label,
      icon: a.icon,
      color: a.color,
      _section: apiRes.length === 0 && i === 0 ? 'Действия' : undefined,
      action: () => { a.action(); close(); },
    }));
  }

  useEffect(() => { setActiveIdx(0); }, [results.length, query]);

  const handleKey = useCallback((e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && results[activeIdx]) {
      results[activeIdx].action();
      close();
    }
  }, [results, activeIdx, close]);

  return (
    <>
      <motion.div className={styles.backdrop} variants={overlayVariants} initial="hidden" animate="visible" exit="exit" onClick={close} />
      <motion.div className={styles.palette} variants={commandInvoke} initial="hidden" animate="visible" exit="exit">
        <div className={styles.hero}>
          <div className={styles.heroBadge}><Sparkles size={12} /> Kort Command</div>
          <div className={styles.heroTitle}>Навигация, команды и поиск в одном контуре</div>
          <div className={styles.heroSub}>Используйте @ для типа сущности, / для команды и Enter для мгновенного действия.</div>
          <div className={styles.heroMeta}>Palette ведёт к действию, ассистент помогает выбрать следующий лучший ход.</div>
          <div className={styles.heroChips}>
            {[
              { label: '@customer', value: '@customer ' },
              { label: '@deal', value: '@deal ' },
              { label: '@task', value: '@task ' },
              { label: '/клиент', value: '/клиент' },
              { label: 'AI next step', value: 'assistant:next-step' },
            ].map((hint) => (
              <button
                key={hint.label}
                onClick={() => {
                  if (hint.value === 'assistant:next-step') {
                    ui.openAssistantPrompt('Какой следующий шаг по текущему контексту?');
                    close();
                    return;
                  }
                  setQuery(hint.value);
                }}
                className={styles.heroChip}
              >
                <Wand2 size={12} /> {hint.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.inputWrap}>
          {searching ? <Loader2 size={15} className={styles.spinnerIcon} /> : <Search size={15} className={styles.searchIcon} />}
          <input ref={inputRef} className={styles.input} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKey} placeholder="Поиск · @ для фильтра · / для команд" />
          {filterType && (
            <span className={styles.filterChip} style={filterChipVars(filterType)}>
              {filterType === 'customer' ? 'Клиенты' : filterType === 'deal' ? 'Сделки' : 'Задачи'}
              <button onClick={() => setQuery('')} className={styles.filterChipClear} aria-label="Сбросить фильтр">
                <X size={12} />
              </button>
            </span>
          )}
          {query && <button className={styles.clearBtn} onClick={() => setQuery('')} aria-label="Очистить запрос"><X size={12} /></button>}
        </div>

        {!query && (
          <div className={styles.hintRow}>
            <span className={styles.helperHint}><Command size={12} /> Быстрый путь по Kort</span>
            <span className={styles.helperHint}><CornerDownLeft size={12} /> Enter открывает активный результат</span>
          </div>
        )}

        <div className={styles.results}>
          {results.length === 0 && query.length >= 1 && !searching && (
            <div className={styles.empty}>
              <div className={styles.emptyBadge}>Ничего не найдено</div>
              <div className={styles.emptyTitle}>По «{query}» пока пусто</div>
              <div className={styles.emptySub}>Попробуйте сменить тип через @ или выполните действие через /команду.</div>
              <div className={styles.emptyMeta}>Retry path · смените контекст и Kort предложит следующий ход.</div>
              <div className={styles.emptyActions}>
                <button className={styles.emptyActionBtn} onClick={() => { ui.openAssistantPrompt(`Помоги найти следующий ход по запросу: ${query}`); close(); }}>Спросить Copilot</button>
                <button className={styles.emptyAction} onClick={() => setQuery('/клиент')}>/клиент</button>
                <button className={styles.emptyAction} onClick={() => setQuery('@deal ')}>@deal</button>
                <button className={styles.emptyAction} onClick={() => { ui.openAssistantPrompt(`Помоги найти следующий шаг по запросу: ${query}`); close(); }}>Спросить AI</button>
                <button className={styles.emptyAction} onClick={() => setQuery('')}>Сбросить</button>
              </div>
            </div>
          )}

          {results.map((r, idx) => (
            <div key={r.id}>
              {r._section && <div className={styles.sectionLabel}>{r._section}</div>}
              <button className={[styles.resultItem, idx === activeIdx ? styles.resultItemActive : ''].join(' ')} onMouseEnter={() => setActiveIdx(idx)} onClick={() => { r.action(); close(); }}>
                <span className={styles.resultIcon} style={resultIconVars(r.type, r.color)}>{r.icon}</span>
                <span className={styles.resultText}>
                  <span className={styles.resultLabel}>{r.label}</span>
                  {r.sub && <span className={styles.resultSub}>{r.sub}</span>}
                </span>
                {(r as any).meta?.follow_up_due_at && <span className={[styles.metaPill, styles.metaPillFollowup].join(' ')}>follow-up</span>}
                {(r as any).meta?.amount != null && (r as any).meta.amount > 0 && <span className={styles.metaAmount}>{Number((r as any).meta.amount).toLocaleString('ru')} {(r as any).meta.currency || '₸'}</span>}
                {(r as any).meta?.priority === 'high' && <span className={[styles.metaPill, styles.metaPillHigh].join(' ')}>high</span>}
                <ArrowRight size={12} className={styles.resultArrow} />
              </button>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <span><kbd className={styles.kbd}>↑↓</kbd> навигация</span>
          <span><kbd className={styles.kbd}>↵</kbd> выбрать</span>
          <span><kbd className={styles.kbd}>esc</kbd> закрыть</span>
        </div>
      </motion.div>
    </>
  );
}
