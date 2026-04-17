/**
 * Shared item-line formatters for Chapan order screens.
 *
 * buildItemLine     — Orders, Ready, Warehouse, OrderDetail, Production, Documents
 *                     Format: «Товар - Цвет (пол)»  (dash per requirement #18)
 *
 * buildTaskMetaLine — Production card metaLine (secondary row)
 *                     Format: «ткань · размер · дл. XX · × N»
 *                     Color / gender are now in the primary line — not repeated here.
 */

export function buildItemLine(
  item: {
    productName?: string;
    color?: string | null;
    gender?: string | null;
  } | undefined | null,
): string {
  if (!item) return '';
  const productName = (item.productName ?? '').trim();
  const color       = (item.color       ?? '').trim();
  const gender      = (item.gender      ?? '').trim();

  const parts: string[] = [];
  if (productName) parts.push(productName);
  if (color)       parts.push(color);

  const line = parts.join(' - ');
  if (!line) return '';
  return gender ? `${line} (${gender})` : line;
}

export function buildTaskMetaLine(task: {
  size?: string | null;
  length?: string | null;
  quantity?: number;
  // color / gender intentionally excluded — they go in the primary buildItemLine row
}): string {
  return [
    task.size,
    task.length ? `дл. ${task.length}` : '',
    (task.quantity ?? 0) > 1 ? `× ${task.quantity}` : '',
  ].filter(Boolean).join(' · ');
}
