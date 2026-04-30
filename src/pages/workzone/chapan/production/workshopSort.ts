import type { ProductionTask } from '@/entities/order/types';

export function sortWorkshopTasks(
  tasks: ProductionTask[],
  today = new Date().toISOString().slice(0, 10),
): ProductionTask[] {
  return [...tasks].sort((a, b) => {
    const aNull = !a.order.dueDate;
    const bNull = !b.order.dueDate;

    // Nulls always last
    if (aNull && !bNull) return 1;
    if (!aNull && bNull) return -1;
    if (aNull && bNull) return 0;

    const aOverdue = a.order.dueDate! < today;
    const bOverdue = b.order.dueDate! < today;

    // Overdue before non-overdue
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    // Within same bucket (both overdue or both not): sort by due date ascending
    const dateDiff = a.order.dueDate!.localeCompare(b.order.dueDate!);
    if (dateDiff !== 0) return dateDiff;

    // Tiebreak: urgent first
    const urgA = (a.order.urgency ?? a.order.priority) === 'urgent' ? 0 : 1;
    const urgB = (b.order.urgency ?? b.order.priority) === 'urgent' ? 0 : 1;
    return urgA - urgB;
  });
}
