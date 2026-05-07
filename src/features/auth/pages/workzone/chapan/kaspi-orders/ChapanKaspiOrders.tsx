import { NavLink, Outlet } from 'react-router-dom';
import { Download, PlugZap, RefreshCw, ShieldCheck, Store } from 'lucide-react';
import { useState } from 'react';
import {
  useDisconnectKaspiConnection,
  useExportKaspiConnection,
  useKaspiConnection,
  useKaspiConnections,
  useKaspiOrdersSummary,
  useSaveKaspiConnection,
  useSyncKaspiOrders,
  useTestKaspiConnection,
} from '../../../../../../entities/kaspi/queries';
import type { SaveKaspiConnectionDto } from '../../../../../../entities/kaspi/types';
import { useRole } from '../../../../../../shared/hooks/useRole';
import {
  formatKaspiDateTime,
  KASPI_STAGE_META,
  getKaspiStageCount,
} from './kaspi-view-model';
import styles from './ChapanKaspiOrders.module.css';

function ConnectionPanel() {
  const { isOwner, isAdmin } = useRole();
  const canManage = isOwner || isAdmin;
  const { data: connection, isLoading } = useKaspiConnection();
  const saveConnection = useSaveKaspiConnection();
  const disconnectConnection = useDisconnectKaspiConnection();
  const testConnection = useTestKaspiConnection();
  const syncOrders = useSyncKaspiOrders();
  const [form, setForm] = useState<SaveKaspiConnectionDto>({
    sellerName: '',
    apiToken: '',
    isActive: true,
  });
  const [showEditForm, setShowEditForm] = useState(false);

  if (isLoading) {
    return (
      <section className={styles.panel}>
        <div className={styles.panelTitle}>{'\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 Kaspi'}</div>
      </section>
    );
  }

  if (!connection) {
    return (
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelTitle}>{'\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 Kaspi'}</div>
            <div className={styles.panelSub}>
              {'\u041c\u043e\u0436\u043d\u043e \u043f\u043e\u0434\u0432\u044f\u0437\u0430\u0442\u044c \u043d\u043e\u0432\u044b\u0439 \u043c\u0430\u0433\u0430\u0437\u0438\u043d \u0438\u0437 \u0438\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430. \u041f\u0440\u043e\u0448\u043b\u044b\u0435 \u043c\u0430\u0433\u0430\u0437\u0438\u043d\u044b \u043f\u0440\u0438 \u044d\u0442\u043e\u043c \u043e\u0441\u0442\u0430\u044e\u0442\u0441\u044f \u0432 history \u0438 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b \u0434\u043b\u044f Excel export.'}
            </div>
          </div>
        </div>

        {canManage ? (
          <>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="kaspi-seller-name">{'\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043c\u0430\u0433\u0430\u0437\u0438\u043d\u0430'}</label>
                <input
                  id="kaspi-seller-name"
                  value={form.sellerName ?? ''}
                  onChange={(event) => setForm((current) => ({ ...current, sellerName: event.target.value }))}
                  placeholder="Kaspi seller"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="kaspi-api-token">API token</label>
                <input
                  id="kaspi-api-token"
                  value={form.apiToken ?? ''}
                  onChange={(event) => setForm((current) => ({ ...current, apiToken: event.target.value }))}
                  placeholder="X-Auth-Token"
                />
              </div>
            </div>
            <div className={styles.headerActions}>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonPrimary}`}
                onClick={() => saveConnection.mutate(form)}
                disabled={saveConnection.isPending || !(form.apiToken ?? '').trim()}
              >
                <ShieldCheck size={14} />
                <span>{'\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u043c\u0430\u0433\u0430\u0437\u0438\u043d'}</span>
              </button>
            </div>
          </>
        ) : (
          <div className={styles.empty}>
            <Store size={24} />
            <div>{'\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 Kaspi \u0434\u043e\u043b\u0436\u0435\u043d \u043d\u0430\u0441\u0442\u0440\u043e\u0438\u0442\u044c admin \u0438\u043b\u0438 owner.'}</div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.panelTitle}>{'\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 Kaspi'}</div>
          <div className={styles.panelSub}>
            {'\u0422\u0435\u043a\u0443\u0449\u0438\u0439 \u043c\u0430\u0433\u0430\u0437\u0438\u043d \u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044f \u0432 read-only mode. \u041f\u0440\u0438 \u0441\u043c\u0435\u043d\u0435 token \u043f\u0440\u043e\u0448\u043b\u044b\u0435 \u0437\u0430\u043a\u0430\u0437\u044b \u043d\u0435 \u043f\u0440\u043e\u043f\u0430\u0434\u0430\u044e\u0442, \u0430 \u0443\u0445\u043e\u0434\u044f\u0442 \u0432 history.'}
          </div>
        </div>
        {canManage && (
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.button}
              onClick={() => setShowEditForm((current) => !current)}
            >
              <span>{showEditForm ? '\u0421\u043a\u0440\u044b\u0442\u044c token form' : '\u041f\u043e\u0434\u0432\u044f\u0437\u0430\u0442\u044c \u0434\u0440\u0443\u0433\u043e\u0439 token'}</span>
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => disconnectConnection.mutate()}
              disabled={disconnectConnection.isPending}
            >
              <PlugZap size={14} />
              <span>{'\u041e\u0442\u0432\u044f\u0437\u0430\u0442\u044c'}</span>
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => testConnection.mutate()}
              disabled={testConnection.isPending}
            >
              <ShieldCheck size={14} />
              <span>{'\u041f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c'}</span>
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonPrimary}`}
              onClick={() => syncOrders.mutate()}
              disabled={syncOrders.isPending}
            >
              <RefreshCw size={14} />
              <span>{'\u0421\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0438\u0440\u043e\u0432\u0430\u0442\u044c'}</span>
            </button>
          </div>
        )}
      </div>

      <div className={styles.recordTableWrap}>
        <table className={styles.compactTable}>
          <tbody>
            <tr>
              <th>{'\u041c\u0430\u0433\u0430\u0437\u0438\u043d'}</th>
              <td>{connection.sellerName || '\u2014'}</td>
              <th>Token</th>
              <td className={styles.mono}>{connection.tokenMasked}</td>
            </tr>
            <tr>
              <th>{'\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u044f\u044f \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0430'}</th>
              <td>{formatKaspiDateTime(connection.lastCheckedAt)}</td>
              <th>{'\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 sync'}</th>
              <td>{formatKaspiDateTime(connection.lastSyncAt)}</td>
            </tr>
            <tr>
              <th>{'\u0421\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435'}</th>
              <td>{connection.isActive ? '\u0410\u043a\u0442\u0438\u0432\u043d\u043e' : '\u0412\u044b\u043a\u043b\u044e\u0447\u0435\u043d\u043e'}</td>
              <th>{'\u041e\u0448\u0438\u0431\u043a\u0430 sync'}</th>
              <td>{connection.lastSyncError || '\u2014'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {canManage && showEditForm && (
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label htmlFor="kaspi-seller-name-edit">{'\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043c\u0430\u0433\u0430\u0437\u0438\u043d\u0430'}</label>
            <input
              id="kaspi-seller-name-edit"
              value={form.sellerName ?? connection.sellerName ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, sellerName: event.target.value }))}
              placeholder={connection.sellerName || 'Kaspi seller'}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="kaspi-api-token-edit">{'\u041d\u043e\u0432\u044b\u0439 API token'}</label>
            <input
              id="kaspi-api-token-edit"
              value={form.apiToken ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, apiToken: event.target.value }))}
              placeholder="X-Auth-Token"
            />
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonPrimary}`}
              onClick={() => saveConnection.mutate({
                sellerName: (form.sellerName ?? connection.sellerName ?? '').trim() || undefined,
                apiToken: form.apiToken,
                isActive: true,
              })}
              disabled={saveConnection.isPending || !(form.apiToken ?? '').trim()}
            >
              <ShieldCheck size={14} />
              <span>{'\u041f\u043e\u0434\u0432\u044f\u0437\u0430\u0442\u044c \u0434\u0440\u0443\u0433\u043e\u0439 token'}</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ConnectionHistoryPanel() {
  const { data: connections, isLoading } = useKaspiConnections();
  const exportConnection = useExportKaspiConnection();

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.panelTitle}>{'\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u043c\u0430\u0433\u0430\u0437\u0438\u043d\u043e\u0432 Kaspi'}</div>
          <div className={styles.panelSub}>
            {'\u041f\u043e\u0441\u043b\u0435 \u0441\u043c\u0435\u043d\u044b token \u0441\u0442\u0430\u0440\u044b\u0439 \u043c\u0430\u0433\u0430\u0437\u0438\u043d \u0443\u0445\u043e\u0434\u0438\u0442 \u0432 \u0430\u0440\u0445\u0438\u0432. \u0417\u0430\u043f\u0438\u0441\u0438 \u043f\u0440\u043e\u0448\u043b\u043e\u0433\u043e \u043c\u0430\u0433\u0430\u0437\u0438\u043d\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u044e\u0442\u0441\u044f \u0438 \u043c\u043e\u0433\u0443\u0442 \u0432\u044b\u0433\u0440\u0443\u0436\u0430\u0442\u044c\u0441\u044f \u0432 Excel.'}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.empty}>
          <RefreshCw size={22} />
          <div>{'\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 history...'}</div>
        </div>
      ) : (
        <div className={styles.recordTableWrap}>
          <table className={styles.compactTable}>
            <thead>
              <tr>
                <th>{'\u0421\u0442\u0430\u0442\u0443\u0441'}</th>
                <th>{'\u041c\u0430\u0433\u0430\u0437\u0438\u043d'}</th>
                <th>{'\u0417\u0430\u043a\u0430\u0437\u044b'}</th>
                <th>{'\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 update'}</th>
                <th>{'\u042d\u043a\u0441\u043f\u043e\u0440\u0442'}</th>
              </tr>
            </thead>
            <tbody>
              {(connections ?? []).map((connection) => (
                <tr key={connection.id}>
                  <td>{connection.isActive ? '\u0422\u0435\u043a\u0443\u0449\u0438\u0439' : '\u0410\u0440\u0445\u0438\u0432'}</td>
                  <td>
                    <div className={styles.stack}>
                      <strong>{connection.sellerName || '\u2014'}</strong>
                      <span className={styles.metaLabel}>{connection.tokenMasked}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.stack}>
                      <span>{connection.ordersCount}</span>
                      <span className={styles.metaLabel}>
                        completed: {connection.completedOrdersCount} / cancelled: {connection.cancelledOrdersCount}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.stack}>
                      <span>{formatKaspiDateTime(connection.lastOrderUpdateAt)}</span>
                      <span className={styles.metaLabel}>
                        {formatKaspiDateTime(connection.archivedAt || connection.updatedAt)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.button}
                      onClick={() => exportConnection.mutate(connection.id)}
                      disabled={exportConnection.isPending}
                    >
                      <Download size={14} />
                      <span>XLSX</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StageRegistryPanel() {
  const summaryQuery = useKaspiOrdersSummary();
  const summary = summaryQuery.data;
  const renderStageCount = (stageKey: (typeof KASPI_STAGE_META)[number]['key']) => {
    if (summaryQuery.isLoading || summaryQuery.isError) {
      return '\u2014';
    }
    return getKaspiStageCount(summary, stageKey);
  };

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.panelTitle}>{'\u0420\u0435\u0435\u0441\u0442\u0440 Kaspi flow'}</div>
          <div className={styles.panelSub}>
            {'\u0412\u043d\u0443\u0442\u0440\u0438 \u044d\u0442\u043e\u0433\u043e \u0440\u0430\u0437\u0434\u0435\u043b\u0430 Kaspi \u0436\u0438\u0432\u0451\u0442 \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e: \u0441\u0432\u043e\u0438 \u044d\u0442\u0430\u043f\u044b, \u0441\u0432\u043e\u0439 stock registry \u0438 \u0441\u0432\u043e\u0439 detail \u0437\u0430\u043a\u0430\u0437\u0430.'}
          </div>
        </div>
      </div>

      {summaryQuery.isLoading && (
        <div className={styles.toolbarNote}>
          <RefreshCw size={14} />
          <span>{'\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 summary \u043f\u043e Kaspi...'}</span>
        </div>
      )}

      {summaryQuery.isError && (
        <div className={styles.toolbarNote}>
          <span>{'\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c summary. \u0415\u0441\u043b\u0438 \u043a\u043d\u043e\u043f\u043a\u0430 sync \u0434\u0430\u0451\u0442 timeout, \u044d\u0442\u043e \u0442\u0435\u043f\u0435\u0440\u044c \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e \u0432\u0438\u0434\u043d\u043e, \u0430 \u043d\u0435 \u043c\u0430\u0441\u043a\u0438\u0440\u0443\u0435\u0442\u0441\u044f \u043d\u0443\u043b\u044f\u043c\u0438.'}</span>
        </div>
      )}

      <div className={styles.recordTableWrap}>
        <table className={styles.compactTable}>
          <thead>
            <tr>
              <th>{'\u0420\u0430\u0437\u0434\u0435\u043b'}</th>
              <th>{'\u041a\u043e\u043b-\u0432\u043e'}</th>
              <th>{'\u041d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435'}</th>
            </tr>
          </thead>
          <tbody>
            {KASPI_STAGE_META.map((item) => (
              <tr key={item.key}>
                <td>
                  <NavLink to={item.to} className={({ isActive }) => `${styles.sectionLink} ${isActive ? styles.sectionLinkActive : ''}`}>
                    {item.label}
                  </NavLink>
                </td>
                <td>{renderStageCount(item.key)}</td>
                <td>{item.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav className={styles.sectionNav}>
        {KASPI_STAGE_META.map((item) => (
          <NavLink
            key={item.key}
            to={item.to}
            className={({ isActive }) => `${styles.sectionPill} ${isActive ? styles.sectionPillActive : ''}`}
          >
            <span>{item.label}</span>
            <strong>{renderStageCount(item.key)}</strong>
          </NavLink>
        ))}
      </nav>
    </section>
  );
}

export default function ChapanKaspiOrdersLayout() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleWrap}>
          <div className={styles.title}>
            <Store size={20} />
            <span>{'Kaspi \u0437\u0430\u043a\u0430\u0437\u044b'}</span>
          </div>
          <div className={styles.subtitle}>
            {'\u041e\u0442\u0434\u0435\u043b\u044c\u043d\u044b\u0439 operational surface \u0432\u043d\u0443\u0442\u0440\u0438 Chapan: \u0431\u0435\u0437 manual create/edit flow \u0438 \u0431\u0435\u0437 dashboard-\u0432\u0438\u0442\u0440\u0438\u043d.'}
          </div>
        </div>
      </header>

      <ConnectionPanel />
      <ConnectionHistoryPanel />
      <StageRegistryPanel />
      <Outlet />
    </div>
  );
}
