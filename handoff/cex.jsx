const { useState, useMemo, useRef, useEffect } = React;

/* ── Icons ── */
function Ico({ d, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
const I = {
  search:    "M21 21l-4.35-4.35M11 19A8 8 0 1 0 11 3a8 8 0 0 0 0 16z",
  calendar:  "M3 4h18v17H3zM16 2v4M8 2v4M3 10h18",
  factory:   "M2 20V9l7-5v5l7-5v16M17 20V7l5-3v16M2 20h20M5 14h2v6H5zM9 14h2v6H9zM13 14h2v6h-2z",
  orders:    "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 4 0M9 5h6",
  archive:   "M21 8V21H3V8M1 3h22v5H1zM10 12h4",
  shipping:  "M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  warehouse: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
  invoices:  "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  purchase:  "M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0",
  analytics: "M18 20V10M12 20V4M6 20v-6",
  check:     "M20 6L9 17l-5-5",
  eye:       "M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
};

/* ── Nav config ── */
const NAV = [
  { id: 'orders',     label: 'Заказы',     icon: I.orders    },
  { id: 'production', label: 'Цех',        icon: I.factory   },
  { id: 'shipping',   label: 'Отправка',   icon: I.shipping  },
  { id: 'warehouse',  label: 'Склад',      icon: I.warehouse },
  { id: 'invoices',   label: 'Накладные',  icon: I.invoices  },
  { id: 'purchase',   label: 'Закуп',      icon: I.purchase  },
  { id: 'analytics',  label: 'Аналитика',  icon: I.analytics },
];

/* ── Data ── */
const ALL_TASKS = [
  { id:'t1',  product:'Баян сулу шапаны',   color:null,           quantity:'1', size:'50', length:null,        gender:'жен', notes:'Оюы қошқар мүйіз болуы керек', order:{ num:'ORD-256', due:'2026-04-27', recv:'2026-04-20', client:'Мадина',   urgent:true,  vip:false } },
  { id:'t2',  product:'Баян сулу жилеті',   color:'Светлый беж',  quantity:'1', size:'44', length:null,        gender:'жен', notes:null, order:{ num:'ORD-256', due:'2026-04-27', recv:'2026-04-20', client:'Мадина',   urgent:true,  vip:false } },
  { id:'t4',  product:'Қозы Керпеш шапаны', color:null,           quantity:'2', size:'52', length:null,        gender:'муж', notes:null, order:{ num:'ORD-256', due:'2026-04-27', recv:'2026-04-19', client:'Мадина',   urgent:true,  vip:false } },
  { id:'t3',  product:'Сардар шапаны',      color:'Светлый беж',  quantity:'1', size:'54', length:'Короткий',  gender:'муж', notes:'Кашемир', order:{ num:'ORD-260', due:'2026-04-28', recv:'2026-04-21', client:'Асель',    urgent:true,  vip:false } },
  { id:'t5',  product:'Жар шапаны',         color:'Шоколадный',   quantity:'3', size:'52', length:'Короткий',  gender:'муж', notes:null, order:{ num:'ORD-242', due:'2026-04-27', recv:'2026-04-15', client:'Айгерим',  urgent:false, vip:true  } },
  { id:'t6',  product:'Жар шапаны',         color:'Шоколадный',   quantity:'1', size:'50', length:'Короткий',  gender:'муж', notes:null, order:{ num:'ORD-242', due:'2026-04-27', recv:'2026-04-15', client:'Айгерим',  urgent:false, vip:true  } },
  { id:'t7',  product:'Қозы Керпеш шапаны', color:'Светлый беж',  quantity:'2', size:'52', length:'Стандарт',  gender:'муж', notes:null, order:{ num:'ORD-233', due:'2026-04-25', recv:'2026-04-14', client:'Айнур',    urgent:false, vip:true  } },
  { id:'t8',  product:'Байсал жилеті',      color:'Черный',       quantity:'1', size:'52', length:null,        gender:'муж', notes:null, order:{ num:'ORD-157', due:'2026-04-18', recv:'2026-04-08', client:'Зарина',   urgent:false, vip:true  } },
  { id:'t9',  product:'Байсал жилеті',      color:'Черный',       quantity:'1', size:'48', length:null,        gender:'муж', notes:null, order:{ num:'ORD-157', due:'2026-04-18', recv:'2026-04-08', client:'Зарина',   urgent:false, vip:true  } },
  { id:'t10', product:'Баян сулу жилеті',   color:'Оранжевый',    quantity:'2', size:'46', length:null,        gender:'муж', notes:null, order:{ num:'ORD-147', due:'2026-04-21', recv:'2026-04-05', client:'Дамир',    urgent:false, vip:true  } },
  { id:'t11', product:'Жар шапаны',         color:'Светлый беж',  quantity:'1', size:'50', length:'Короткий',  gender:'муж', notes:null, order:{ num:'ORD-147', due:'2026-04-21', recv:'2026-04-05', client:'Дамир',    urgent:false, vip:true  } },
  { id:'t12', product:'Баян сулу жилеті',   color:'Изумруд',      quantity:'1', size:'52', length:'Короткий',  gender:'жен', notes:'В подарок', order:{ num:'ORD-212', due:'2026-04-24', recv:'2026-04-10', client:'Гульмира', urgent:false, vip:true  } },
  { id:'t13', product:'Қозы Керпеш шапаны', color:null,           quantity:'1', size:'52', length:null,        gender:'муж', notes:null, order:{ num:'ORD-270', due:'2026-05-03', recv:'2026-04-24', client:'Арман',    urgent:false, vip:false } },
  { id:'t14', product:'Жар шапаны',         color:'Светлый беж',  quantity:'2', size:'50', length:'Короткий',  gender:'муж', notes:null, order:{ num:'ORD-271', due:'2026-05-05', recv:'2026-04-25', client:'Болат',    urgent:false, vip:false } },
  { id:'t15', product:'Сардар шапаны',      color:'Синий',        quantity:'1', size:'48', length:'Стандарт',  gender:'жен', notes:null, order:{ num:'ORD-272', due:'2026-05-07', recv:'2026-04-26', client:'Динара',   urgent:false, vip:false } },
];

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('ru-KZ', { day:'numeric', month:'short' }) : '—';
}

function sortTasks(arr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return [...arr].sort((a, b) => {
    // Parse due dates
    const aDueDate = a.order.due ? new Date(a.order.due) : new Date('9999-12-31');
    const bDueDate = b.order.due ? new Date(b.order.due) : new Date('9999-12-31');
    aDueDate.setHours(0, 0, 0, 0);
    bDueDate.setHours(0, 0, 0, 0);
    
    // Check if overdue (due date < today)
    const aOverdue = aDueDate < today;
    const bOverdue = bDueDate < today;
    
    // 1. Overdue (with same due date) first
    if (aOverdue && bOverdue) {
      // Both overdue: sort by due date ascending
      if (aDueDate !== bDueDate) return aDueDate.getTime() - bDueDate.getTime();
      // Same due date: urgent first
      return a.order.urgent ? -1 : 1;
    }
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    
    // 2. Not overdue: sort by due date ascending
    if (aDueDate !== bDueDate) return aDueDate.getTime() - bDueDate.getTime();
    
    // 3. Same due date: urgent first
    if (a.order.urgent !== b.order.urgent) return a.order.urgent ? -1 : 1;
    
    // 4. Same everything: keep original order
    return 0;
  });
}

/* ── Date popover ── */
function DateFilter({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div className="pop-wrap" ref={ref}>
      <button className={`tb-btn${value ? ' active' : ''}`} onClick={() => setOpen(v => !v)}>
        <Ico d={I.calendar} size={12} /> {label}
      </button>
      <div className={`date-pop${open ? ' open' : ''}`}>
        <input type="date" className="date-inp"
          value={value || ''}
          onChange={e => { onChange(e.target.value || null); setOpen(false); }} />
        {value && (
          <button onClick={() => { onChange(null); setOpen(false); }}
            style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}>
            Сбросить
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Task row (unified grid) ── */
function TaskRow({ task, selected, onToggle, onDone }) {
  const urgent  = task.order.urgent;
  const vip     = !urgent && task.order.vip;
  const hasNote = !!task.notes;
  const orderNum = `${task.order.num.replace('ORD-', '')}-${task.position}`;

  return (
    <div className={`row${selected ? ' is-sel' : ''}${!hasNote ? ' without-note' : ' with-note'}`}>
      {/* Checkbox — col 1 */}
      <div className={`cell center cb-wrap col-1${hasNote ? ' span-2' : ''}`} style={{ gridColumn: 1 }} onClick={() => onToggle(task.id)}>
        <div className={`cb${selected ? ' checked' : ''}`}>
          {selected && <div className="cb-tick"></div>}
        </div>
      </div>

      {/* Urgency badge — col 2 */}
      <div className={`cell center col-2${hasNote ? ' span-2' : ''}`} style={{ gridColumn: 2 }}>
        {urgent && <span className="badge urgent">!</span>}
        {vip    && <span className="badge vip">★</span>}
      </div>

      {/* Order number — col 3 */}
      <div className={`cell mono order-num col-3${hasNote ? ' span-2' : ''}`} style={{ gridColumn: 3 }}>
        №{orderNum}
      </div>

      {/* Product name — col 4 */}
      <div className={`cell product-name col-4`} style={{ gridColumn: 4 }}>
        {task.product}
      </div>

      {/* Gender — col 5 */}
      <div className={`cell center col-5`} style={{ gridColumn: 5, color: 'var(--text-secondary)' }}>
        {task.gender}
      </div>

      {/* Length — col 6 */}
      <div className={`cell col-6${task.length ? '' : ' cell-muted'}`} style={{ gridColumn: 6, color: task.length ? 'var(--text-secondary)' : undefined }}>
        {task.length || '—'}
      </div>

      {/* Color — col 7 (hidden when has note) */}
      {!hasNote && (
        <div className={`cell col-7${task.color ? '' : ' cell-muted'}`} style={{ gridColumn: 7, color: task.color ? 'var(--text-secondary)' : undefined }}>
          {task.color || '—'}
        </div>
      )}

      {/* Quantity — col 8 */}
      <div className={`cell center col-8${hasNote ? ' span-2' : ''}`} style={{ gridColumn: 8, fontWeight: 600 }}>
        {task.quantity}
      </div>

      {/* Size — col 9 */}
      <div className={`cell center col-9${hasNote ? ' span-2' : ''}`} style={{ gridColumn: 9, fontWeight: 600 }}>
        {task.size}
      </div>

      {/* Received date — col 10 */}
      <div className={`cell cell-muted col-10${hasNote ? ' span-2' : ''}`} style={{ gridColumn: 10 }}>
        {fmtDate(task.order.recv)}
      </div>

      {/* Due date — col 11 */}
      <div className={`cell cell-muted col-11${hasNote ? ' span-2' : ''}`} style={{ gridColumn: 11 }}>
        {fmtDate(task.order.due)}
      </div>

      {/* Done button — col 12 */}
      <div className={`cell center col-12${hasNote ? ' span-2' : ''}`} style={{ gridColumn: 12 }}>
        <button className="done-btn" onClick={() => onDone(task.id)}>
          <Ico d={I.check} size={10} /> Готово
        </button>
      </div>

      {/* Note row — grid column 4-7, row 2 (only if note present) */}
      {/* Note row — only if note present */}
      {hasNote && (
        <div className="cell-note">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="9" r="1.5" fill="white" opacity="0.8"/><circle cx="8" cy="14" r="1.5" fill="white" opacity="0.8"/><circle cx="16" cy="14" r="1.5" fill="white" opacity="0.8"/></svg>
          {task.notes}
        </div>
      )}
    </div>
  );
}

/* ── Task card (single position) ── */
function TaskCard({ task, selected, onToggle, onDone }) {
  const urgent = task.order.urgent;
  const vip    = !urgent && task.order.vip;
  const cls    = `task-card${urgent ? ' is-urgent' : !urgent && vip ? ' is-vip' : ''}`;

  return (
    <div className={cls}>
      <TaskRow task={task} position={1} selected={selected} onToggle={onToggle} onDone={onDone} />
    </div>
  );
}

/* ── App ── */
function App() {
  const [search, setSearch]       = useState('');
  const [dueFilter, setDueFilter] = useState(null);
  const [recvFilter, setRecvFilter] = useState(null);
  const [selected, setSelected]   = useState(new Set());
  const [done, setDone]           = useState(new Set());
  const [hideUnsel, setHideUnsel] = useState(false);
  const [activeNav, setActiveNav] = useState('production');

  const tasks = useMemo(() => {
    let r = ALL_TASKS.filter(t => !done.has(t.id));
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(t => t.order.num.toLowerCase().includes(q) || t.product.toLowerCase().includes(q));
    }
    if (dueFilter)  r = r.filter(t => t.order.due  === dueFilter);
    if (recvFilter) r = r.filter(t => t.order.recv === recvFilter);
    if (hideUnsel && selected.size > 0) r = r.filter(t => selected.has(t.id));
    const sorted = sortTasks(r);
    
    // Add position numbers within each order
    const withPos = [];
    const orderPos = new Map();
    for (const t of sorted) {
      const pos = (orderPos.get(t.order.num) || 0) + 1;
      orderPos.set(t.order.num, pos);
      withPos.push({ ...t, position: pos });
    }
    return withPos;
  }, [search, dueFilter, recvFilter, selected, hideUnsel, done]);

  const orderGroups = useMemo(() => {
    return tasks;
  }, [tasks]);

  const toggleSel = id => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };
  const markDone = id => {
    setDone(p => { const n = new Set(p); n.add(id); return n; });
    setSelected(p => { const n = new Set(p); n.delete(id); return n; });
  };

  return (
    <div className="shell">
      {/* ── Sidebar ── */}
      <nav className="chapan-nav">
        <div className="chapan-brand">
          <div className="chapan-brand-tag">KORT · Чапан</div>
          <div className="chapan-brand-name">Производство</div>
        </div>
        <div className="chapan-links">
          {NAV.map(n => (
            <button key={n.id}
              className={`chapan-link${activeNav === n.id ? ' active' : ''}`}
              onClick={() => setActiveNav(n.id)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={n.icon} />
              </svg>
              {n.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Main ── */}
      <div className="wh-main">
        <div className="page-header">
          <div className="page-title">
            Цех
            <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--text-muted)', marginLeft: 10 }}>
              {tasks.length} позиций
            </span>
          </div>

          <div className="toolbar">
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', left: 10 }}>
                <path d={I.search} />
              </svg>
              <input className="tb-search" style={{ paddingLeft: 30 }}
                placeholder="Заказ или товар…"
                value={search}
                onChange={e => setSearch(e.target.value)} />
            </div>

            <DateFilter label="Срок сдачи" value={dueFilter}  onChange={setDueFilter}  />
            <DateFilter label="Принят"     value={recvFilter} onChange={setRecvFilter} />

            <div className="tb-divider"></div>

            {selected.size > 0 && (
              <button className={`tb-btn${hideUnsel ? ' active' : ''}`}
                onClick={() => setHideUnsel(v => !v)}>
                <Ico d={I.eye} size={12} />
                {hideUnsel ? 'Все' : 'Только выбранные'}
              </button>
            )}
          </div>
        </div>

        {/* Selection bar */}
        {selected.size > 0 && (
          <div className="sel-bar">
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div className="cb checked" style={{ cursor:'pointer' }}
                onClick={() => setSelected(new Set())}>
                <div className="cb-tick"></div>
              </div>
              <span className="sel-cnt">{selected.size} выбрано</span>
            </div>
          </div>
        )}

        <div className="list-area">
          {/* Table header */}
          <div className="table-head">
            <div className="th center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div className="th center">!</div>
            <div className="th center">№</div>
            <div className="th center">Товар</div>
            <div className="th center">Пол</div>
            <div className="th center">Длина</div>
            <div className="th center">Цвет</div>
            <div className="th center">Кол.во</div>
            <div className="th center">Разм.</div>
            <div className="th center">Принят</div>
            <div className="th center">Срок</div>
            <div className="th center">Действие</div>
          </div>

          {orderGroups.length === 0 ? (
            <div className="empty">Нет позиций</div>
          ) : (
            <div className="list-inner">
              {orderGroups.map(t => (
                <TaskCard key={t.id} task={t}
                  selected={selected.has(t.id)}
                  onToggle={toggleSel} onDone={markDone} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);