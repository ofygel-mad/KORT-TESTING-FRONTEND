import type { EmployeePermission } from '../../shared/api/contracts';

export const EMPLOYEE_PERMISSION_OPTIONS: Array<{
  key: EmployeePermission;
  label: string;
  description: string;
}> = [
  {
    key: 'full_access',
    label: 'Полный доступ',
    description: 'Все разделы системы и все действия без ограничений.',
  },
  {
    key: 'chapan_access_orders',
    label: 'Заказы',
    description: 'Просмотр списка заказов, создание и редактирование заказов.',
  },
  {
    key: 'chapan_access_production',
    label: 'Производство',
    description: 'Доступ к производственным задачам и ходу выполнения заказов.',
  },
  {
    key: 'chapan_access_ready',
    label: 'Готовые заказы',
    description: 'Работа с готовыми заказами, передачей и выдачей.',
  },
  {
    key: 'chapan_access_archive',
    label: 'Архив',
    description: 'Просмотр архивных заказов и возврат из архива.',
  },
  {
    key: 'chapan_access_warehouse_nav',
    label: 'Склад и накладные',
    description: 'Доступ к складу, накладным и связанным операциям.',
  },
  {
    key: 'chapan_manage_production',
    label: 'Управление производством',
    description: 'Назначение исполнителей и управление этапами производства.',
  },
  {
    key: 'chapan_confirm_invoice',
    label: 'Подтверждение накладных',
    description: 'Подтверждение отгрузок и приёмки по накладным.',
  },
  {
    key: 'chapan_warehouse_operator',
    label: 'ЗавСклад / Оператор склада',
    description: 'Приём накладных, подтверждение отгрузок и операции на складе.',
  },
  {
    key: 'chapan_shipping',
    label: 'Менеджер отправки',
    description: 'Отправка заказов клиентам, контроль оплаты перед отправкой.',
  },
  {
    key: 'chapan_manage_settings',
    label: 'Настройки модуля',
    description: 'Изменение настроек рабочего модуля и его параметров.',
  },
];
