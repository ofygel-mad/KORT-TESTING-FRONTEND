/**
 * @deprecated Система инвайт-ссылок упразднена (рефакторинг 2025).
 * Сотрудники теперь добавляются только через администратора в настройках.
 * Эту страницу можно удалить, когда бэкенд деактивирует все старые токены.
 */
import { useNavigate } from 'react-router-dom';
import { AuthRouteLayout, AuthRouteStatusCard } from '../../../features/auth/AuthRouteLayout';

export default function AcceptInvitePage() {
  const navigate = useNavigate();

  return (
    <AuthRouteLayout>
      <AuthRouteStatusCard
        eyebrow="Invite"
        title="Система приглашений изменена"
        subtitle="Сотрудники теперь добавляются администратором напрямую. Войдите через номер телефона или обратитесь к руководителю."
        actionLabel="Открыть вход"
        action={() => navigate('/', { replace: true })}
      />
    </AuthRouteLayout>
  );
}
