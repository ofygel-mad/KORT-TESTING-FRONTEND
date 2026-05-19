import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, GitCompareArrows, History, ShieldAlert, X } from 'lucide-react';
import type {
  WarehouseLayoutAnalysis,
  WarehouseLayoutPublishAuditEntry,
  WarehouseLayoutVersion,
  WarehouseLayoutVersionCompareResult,
} from '@/entities/warehouse/types';
import styles from './Warehouse.module.css';

type CompareOption = {
  id: string;
  label: string;
};

export function WarehouseTwinPublishReviewModal({
  open,
  analysis,
  draft,
  liveVersion,
  compareOptions,
  selectedCompareId,
  onSelectCompare,
  compareResult,
  validatePending,
  publishPending,
  forcePublish,
  forceReason,
  publishAudit,
  onToggleForce,
  onForceReasonChange,
  onValidate,
  onPublish,
  onClose,
}: {
  open: boolean;
  analysis: WarehouseLayoutAnalysis | null;
  draft?: WarehouseLayoutVersion | null;
  liveVersion?: WarehouseLayoutVersion | null;
  compareOptions: CompareOption[];
  selectedCompareId?: string;
  onSelectCompare: (value: string) => void;
  compareResult?: WarehouseLayoutVersionCompareResult | null;
  validatePending?: boolean;
  publishPending?: boolean;
  forcePublish: boolean;
  forceReason: string;
  onToggleForce: (value: boolean) => void;
  onForceReasonChange: (value: string) => void;
  publishAudit?: WarehouseLayoutPublishAuditEntry[];
  onValidate: () => void;
  onPublish: () => void;
  onClose: () => void;
}) {
  if (!open || !analysis || !draft) {
    return null;
  }

  const canForce = analysis.publishPolicy.canForcePublish;
  const canPublish = analysis.publishReady || (forcePublish && canForce && forceReason.trim().length >= 6);

  return createPortal(
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(event) => event.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <div>
            <div className={styles.drawerTitle}>Publish Review</div>
            <div className={styles.drawerSubtitle}>
              Draft v{draft.versionNo} against live v{liveVersion?.versionNo ?? '-'}
            </div>
          </div>
          <button type="button" className={styles.drawerClose} onClick={onClose} aria-label="Close publish review">
            <X size={16} />
          </button>
        </div>

        <div className={styles.drawerBody}>
          <div className={styles.drawerStatusRow}>
            <div className={styles.drawerStatusItem}>
              {analysis.publishReady ? <CheckCircle2 size={14} color="var(--fill-positive)" /> : <AlertTriangle size={14} color="var(--fill-negative)" />}
              {analysis.publishReady ? 'Publish-ready' : 'Blocked until reviewed'}
            </div>
            <div className={styles.drawerStatusItem}>
              <ShieldAlert size={14} color={analysis.publishPolicy.canForcePublish ? 'var(--fill-warning)' : 'var(--text-tertiary)'} />
              {analysis.publishPolicy.canForcePublish ? 'Force publish allowed' : 'Force publish blocked'}
            </div>
          </div>

          <div className={styles.drawerCard}>
            <div className={styles.drawerCardLabel}>Governance Summary</div>
            <div className={styles.drawerCardRowSecondary}>
              {analysis.summary.hardBlockers} blockers | {analysis.summary.warnings} warnings | {analysis.summary.impactedTasks} impacted tasks
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>Moved</div>
                <div className={styles.statValue}>{analysis.summary.movedNodes}</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>Hidden</div>
                <div className={styles.statValue}>{analysis.summary.hiddenNodes}</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>Changed</div>
                <div className={styles.statValue}>{analysis.diff.changedNodes.length}</div>
              </div>
            </div>
          </div>

          <div className={styles.drawerCard}>
            <div className={styles.drawerCardLabel}>Policy</div>
            <div className={styles.drawerCardRowSecondary}>
              {analysis.publishPolicy.requiresSupervisorReview
                ? 'Supervisor review required before publish.'
                : 'No supervisor override required.'}
            </div>
            {analysis.publishPolicy.blockedBy.length ? (
              <div className={styles.tdSecondary}>Blocked by: {analysis.publishPolicy.blockedBy.join(', ')}</div>
            ) : null}
            {analysis.publishPolicy.forceActions.length ? (
              <div className={styles.tdSecondary}>Force actions: {analysis.publishPolicy.forceActions.join(' | ')}</div>
            ) : null}
          </div>

          <div className={styles.drawerCard}>
            <div className={styles.drawerCardLabel}>Compare Candidate</div>
            <div style={{ display: 'grid', gap: 8 }}>
              <select
                className={styles.select}
                value={selectedCompareId ?? ''}
                onChange={(event) => onSelectCompare(event.target.value)}
              >
                {compareOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              {compareResult ? (
                <div className={styles.drawerCard}>
                  <div className={styles.drawerCardRow}>
                    <GitCompareArrows size={14} />
                    v{compareResult.leftVersion.versionNo} {'->'} v{compareResult.rightVersion.versionNo}
                  </div>
                  <div className={styles.drawerCardRowSecondary}>
                    {compareResult.summary.createdNodes} created | {compareResult.summary.removedNodes} removed | {compareResult.summary.movedNodes} moved
                  </div>
                  <div className={styles.tdSecondary}>
                    {compareResult.summary.resizedNodes} resized | {compareResult.summary.hiddenChangedNodes} visibility changes
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {analysis.hardBlockers.length ? (
            <div className={styles.drawerCard}>
              <div className={styles.drawerCardLabel}>Hard Blockers</div>
              {analysis.hardBlockers.map((blocker) => (
                <div key={`${blocker.code}:${blocker.taskId ?? blocker.nodeId ?? blocker.domainId ?? blocker.message}`} className={styles.drawerCardRowSecondary} style={{ color: 'var(--fill-negative)' }}>
                  {blocker.message}
                </div>
              ))}
            </div>
          ) : null}

          {analysis.warnings.length ? (
            <div className={styles.drawerCard}>
              <div className={styles.drawerCardLabel}>Warnings</div>
              {analysis.warnings.map((warning) => (
                <div key={`${warning.code}:${warning.taskId ?? warning.nodeId ?? warning.domainId ?? warning.message}`} className={styles.drawerCardRowSecondary} style={{ color: 'var(--fill-warning)' }}>
                  {warning.message}
                </div>
              ))}
            </div>
          ) : null}

          {analysis.taskImpactMatrix.length ? (
            <div className={styles.drawerCard}>
              <div className={styles.drawerCardLabel}>Task Impact Matrix</div>
              {analysis.taskImpactMatrix.map((impact) => (
                <div key={impact.taskId} className={styles.drawerCardRowSecondary}>
                  {impact.title} | {impact.status} | {impact.impactLevel === 'hard_blocker' ? 'blocker' : 'review'}
                </div>
              ))}
            </div>
          ) : null}

          {canForce ? (
            <div className={styles.drawerCard}>
              <div className={styles.drawerCardLabel}>Forced Publish</div>
              <label className={styles.drawerCardRowSecondary} style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={forcePublish}
                  onChange={(event) => onToggleForce(event.target.checked)}
                />
                Pause impacted execution and publish anyway
              </label>
              {forcePublish ? (
                <textarea
                  className={styles.input}
                  value={forceReason}
                  onChange={(event) => onForceReasonChange(event.target.value)}
                  placeholder="Supervisor reason"
                  rows={3}
                />
              ) : null}
            </div>
          ) : null}

          {publishAudit && publishAudit.length > 0 ? (
            <div className={styles.drawerCard}>
              <div className={styles.drawerCardLabel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <History size={13} />
                Publish History
              </div>
              {publishAudit.map((entry) => {
                const actionColor =
                  entry.action === 'force_publish'
                    ? 'var(--fill-negative)'
                    : entry.action === 'rollback'
                    ? 'var(--fill-warning)'
                    : 'var(--fill-positive)';
                const actionLabel =
                  entry.action === 'force_publish' ? 'Force' : entry.action === 'rollback' ? 'Rollback' : 'Publish';

                return (
                  <div key={entry.id} className={styles.drawerCardRowSecondary} style={{ display: 'flex', flexDirection: 'column', gap: 2, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: actionColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {actionLabel}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                        {entry.actorName}
                      </span>
                      <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: 10 }}>
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {entry.impactedTaskCount > 0 ? (
                      <div style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>
                        {entry.impactedTaskCount} task{entry.impactedTaskCount !== 1 ? 's' : ''} impacted
                      </div>
                    ) : null}
                    {entry.forceReason ? (
                      <div style={{ color: 'var(--fill-negative)', fontSize: 10, fontStyle: 'italic' }}>
                        "{entry.forceReason}"
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className={styles.drawerFooter}>
          <div className={styles.drawerActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Close
            </button>
            <button type="button" className={styles.exportBtn} onClick={onValidate} disabled={validatePending}>
              Revalidate
            </button>
            <button type="button" className={styles.submitBtn} onClick={onPublish} disabled={!canPublish || publishPending}>
              {forcePublish ? 'Force Publish' : 'Publish Draft'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
