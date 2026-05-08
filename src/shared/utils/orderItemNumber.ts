const ORDER_ITEM_SUFFIX_RE = /^(.*-\d+)-(\d+)$/;

function trimOrderNumber(value: string): string {
  return value.trim().replace(/^#/, '').replace(/\s+/g, ' ');
}

export function stripOrderItemSuffix(orderNumber: string): string {
  const normalized = trimOrderNumber(orderNumber);
  const match = normalized.match(ORDER_ITEM_SUFFIX_RE);

  if (!match) {
    return normalized;
  }

  return match[1] ?? normalized;
}

export function formatOrderItemNumber(orderNumber: string, position?: number | null): string {
  const baseOrderNumber = stripOrderItemSuffix(orderNumber);
  const numericPosition = Number(position);

  if (Number.isFinite(numericPosition) && numericPosition > 0) {
    return `${baseOrderNumber}-${Math.trunc(numericPosition)}`;
  }

  return baseOrderNumber;
}
