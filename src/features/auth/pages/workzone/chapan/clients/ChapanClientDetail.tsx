import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Mail, Phone, Building2 } from 'lucide-react';
import { useChapanClientDetail } from '@/entities/order/queries';
import { formatPhoneNumber, formatDistanceToNow } from '../../../../shared/lib/formatting';
import { calculateChapanOrderFinancials } from '@/shared/lib/chapanFinancials';
import styles from './ChapanClientDetail.module.css';

export default function ChapanClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: client, isLoading } = useChapanClientDetail(id);

  if (isLoading) {
    return (
      <div className={styles.root}>
        <div className={styles.loading}>Загрузка...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className={styles.root}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          <ChevronLeft size={18} />
          <span>Назад</span>
        </button>
        <div className={styles.empty}>
          <p>Клиент не найден</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <button className={styles.backButton} onClick={() => navigate(-1)}>
        <ChevronLeft size={18} />
        <span>Назад</span>
      </button>

      <div className={styles.header}>
        <div className={styles.avatar}>{client.fullName[0]?.toUpperCase() || '?'}</div>
        <div className={styles.headerInfo}>
          <h1 className={styles.name}>{client.fullName}</h1>
          <div className={styles.badges}>
            {client.retailOrderCount > 0 && <span className={styles.badgeRetail}>Розница</span>}
            {client.wholesaleOrderCount > 0 && <span className={styles.badgeWholesale}>Опт</span>}
            {client.crmCustomerId && <span className={styles.badgeCrm}>Связан с CRM</span>}
          </div>
        </div>
      </div>

      <div className={styles.contact}>
        {client.phone && (
          <div className={styles.contactItem}>
            <Phone size={16} />
            <span>{formatPhoneNumber(client.phone)}</span>
          </div>
        )}
        {client.email && (
          <div className={styles.contactItem}>
            <Mail size={16} />
            <a href={`mailto:${client.email}`}>{client.email}</a>
          </div>
        )}
        {client.company && (
          <div className={styles.contactItem}>
            <Building2 size={16} />
            <span>{client.company}</span>
          </div>
        )}
      </div>

      {client.notes && (
        <div className={styles.notesSection}>
          <h3 className={styles.notesTitle}>Заметки</h3>
          <p className={styles.notes}>{client.notes}</p>
        </div>
      )}

      <div className={styles.statsSection}>
        <h3 className={styles.statsTitle}>Статистика</h3>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Заказов всего</div>
            <div className={styles.statValue}>{client.stats.orderCount}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>На сумму</div>
            <div className={styles.statValue}>{formatAmount(client.stats.totalSpent)} ₸</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Оплачено</div>
            <div className={styles.statValue}>{formatAmount(client.stats.totalPaid)} ₸</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Розница</div>
            <div className={styles.statValue}>{client.stats.retailOrders}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Опт</div>
            <div className={styles.statValue}>{client.stats.wholesaleOrders}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>К оплате</div>
            <div className={styles.statValue}>
              {formatAmount(client.stats.totalSpent - client.stats.totalPaid)} ₸
            </div>
          </div>
        </div>
      </div>

      <div className={styles.ordersSection}>
        <h3 className={styles.ordersTitle}>История заказов ({client.orders.length})</h3>
        {client.orders.length === 0 ? (
          <div className={styles.ordersEmpty}>
            <p>Заказов нет</p>
          </div>
        ) : (
          <div className={styles.ordersList}>
            {client.orders.map((order) => (
              <button
                key={order.id}
                className={styles.orderRow}
                onClick={() => navigate(`/workzone/chapan/orders/${order.id}`)}
              >
                <div className={styles.orderNumber}>{order.orderNumber}</div>
                <div className={styles.orderStatus}>
                  <span className={`${styles.statusBadge} ${styles[`status${order.status}`]}`}>
                    {getStatusLabel(order.status)}
                  </span>
                </div>
                <div className={styles.orderType}>
                  {order.customerType === 'retail' ? (
                    <span className={styles.typeRetail}>Розница</span>
                  ) : (
                    <span className={styles.typeWholesale}>Опт</span>
                  )}
                </div>
                <div className={styles.orderAmount}>
                  {formatAmount(calculateChapanOrderFinancials({
                    itemsSubtotal: order.totalAmount,
                    orderDiscount: order.orderDiscount,
                    deliveryFee: order.deliveryFee,
                    bankCommissionPercent: order.bankCommissionPercent,
                    bankCommissionAmount: order.bankCommissionAmount,
                  }).totalDue)} ₸
                </div>
                <div className={styles.orderDate}>
                  {formatDistanceToNow(new Date(order.createdAt))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    new: 'Новый',
    confirmed: 'Подтвержден',
    in_production: 'В цехе',
    ready: 'Готово',
    transferred: 'Передано',
    on_warehouse: 'На складе',
    shipped: 'Отправлено',
    completed: 'Выполнен',
    cancelled: 'Отменен',
  };
  return labels[status] || status;
}

function formatAmount(amount: number): string {
  if (amount >= 1_000_000) {
    return (amount / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' млн';
  }
  if (amount >= 1_000) {
    return (amount / 1_000).toFixed(0) + ' тыс';
  }
  return amount.toString();
}
