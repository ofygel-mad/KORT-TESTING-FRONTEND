// Backend: /api/v1/company/employees
// Note: prefix is /api/v1/company NOT /api/v1/employees

export type EmployeePermission =
  | 'full_access'
  | 'financial_report'
  | 'sales'
  | 'production'
  | 'warehouse_manager'
  | 'observer'
  // ─── Чапан ───
  | 'chapan_full_access'
  | 'chapan_access_orders'
  | 'chapan_access_production'
  | 'chapan_access_ready'
  | 'chapan_access_archive'
  | 'chapan_access_warehouse_nav'
  | 'chapan_manage_production'
  | 'chapan_confirm_invoice'
  | 'chapan_warehouse_operator'
  | 'chapan_manage_settings';

export interface Employee {
  id: string;                   // userId
  full_name: string;
  phone: string | null;
  department: string;
  permissions: EmployeePermission[];
  status: 'active' | 'dismissed';
  isPendingFirstLogin?: boolean;
  addedByName: string | null;
  joinedAt: string;
}

export const PERMISSION_LABEL: Record<EmployeePermission, string> = {
  full_access: 'Полный доступ',
  financial_report: 'Финансы',
  sales: 'Продажи',
  production: 'Производство',
  warehouse_manager: 'Завсклад',
  observer: 'Наблюдатель',
  chapan_full_access: 'Чапан: полный доступ',
  chapan_access_orders: 'Чапан: Заказы',
  chapan_access_production: 'Чапан: Производство',
  chapan_access_ready: 'Чапан: Готово',
  chapan_access_archive: 'Чапан: Архив',
  chapan_access_warehouse_nav: 'Чапан: Ссылка на Склад',
  chapan_manage_production: 'Чапан: Управление производством',
  chapan_confirm_invoice: 'Чапан: Подтверждение накладных',
  chapan_warehouse_operator: 'Чапан: Сотрудник склада',
  chapan_manage_settings: 'Чапан: Настройки модуля',
};

export const PERMISSION_DESCRIPTION: Record<EmployeePermission, string> = {
  full_access: 'Все функции, включая API и вебхуки.',
  financial_report: 'Excel-импорт/экспорт, финансовая аналитика.',
  sales: 'Лиды, сделки, заявки, сводки.',
  production: 'Раздел производства.',
  warehouse_manager: 'Приёмка, хранение, отгрузка.',
  observer: 'Просмотр без права редактирования.',
  chapan_full_access: 'Все разделы модуля Чапан без ограничений.',
  chapan_access_orders: 'Просмотр, создание и редактирование заказов.',
  chapan_access_production: 'Производственные задачи и ход выполнения.',
  chapan_access_ready: 'Готовые заказы, передача и выдача.',
  chapan_access_archive: 'Архивные заказы и возврат из архива.',
  chapan_access_warehouse_nav: 'Видит кнопку перехода на Склад из модуля Чапан.',
  chapan_manage_production: 'Назначение исполнителей и управление этапами.',
  chapan_confirm_invoice: 'Подтверждение отгрузок по накладным со стороны Чапана.',
  chapan_warehouse_operator: 'Приёмка и отправка заказов на складе.',
  chapan_manage_settings: 'Изменение настроек рабочего модуля Чапан.',
};

export const BASE_PERMISSIONS: EmployeePermission[] = [
  'full_access', 'financial_report', 'sales', 'production', 'warehouse_manager', 'observer',
];

export const CHAPAN_PERMISSIONS: EmployeePermission[] = [
  'chapan_full_access', 'chapan_access_orders', 'chapan_access_production',
  'chapan_access_ready', 'chapan_access_archive', 'chapan_access_warehouse_nav',
  'chapan_manage_production', 'chapan_confirm_invoice', 'chapan_warehouse_operator',
  'chapan_manage_settings',
];

export interface CreateEmployeeDto {
  phone: string;       // +7XXXXXXXXXX format
  full_name: string;
  department: string;
  permissions: EmployeePermission[];
}

export interface UpdateEmployeeDto {
  department?: string;
  permissions?: EmployeePermission[];
}
