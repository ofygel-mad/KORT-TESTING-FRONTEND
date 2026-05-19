import type { WarehouseItem } from '@/entities/warehouse/types';

export interface ProductGroup {
  name: string;
  items: WarehouseItem[];
  totalQty: number;
  totalReserved: number;
  sizeBreakdown: Array<{ value: string; qty: number; reserved: number }>;
  colorBreakdown: Array<{ value: string; qty: number; reserved: number }>;
}

export function groupItemsByProduct(items: WarehouseItem[]): ProductGroup[] {
  const grouped = new Map<string, WarehouseItem[]>();

  // Group by product name
  for (const item of items) {
    const key = item.name.toLowerCase();
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(item);
  }

  // Convert to ProductGroup array
  return Array.from(grouped.entries()).map(([name, itemsInGroup]) => {
    const totalQty = itemsInGroup.reduce((sum, item) => sum + item.qty, 0);
    const totalReserved = itemsInGroup.reduce((sum, item) => sum + item.qtyReserved, 0);

    // Extract size breakdown (assumes "Размер" or similar attribute)
    const sizeMap = new Map<string, { qty: number; reserved: number }>();
    const colorMap = new Map<string, { qty: number; reserved: number }>();

    for (const item of itemsInGroup) {
      // Size: primary from attributesJson (stored by CreateItemDto.size), fallback to numeric tag
      const sizeVal =
        item.attributesJson?.['size'] ||
        item.tags?.find(t => /^\d+$/.test(t));
      if (sizeVal) {
        const entry = sizeMap.get(sizeVal) ?? { qty: 0, reserved: 0 };
        entry.qty += item.qty;
        entry.reserved += item.qtyReserved;
        sizeMap.set(sizeVal, entry);
      }

      // Color: from attributesJson (stored by CreateItemDto.color)
      const colorVal = item.attributesJson?.['color'];
      if (colorVal) {
        const entry = colorMap.get(colorVal) ?? { qty: 0, reserved: 0 };
        entry.qty += item.qty;
        entry.reserved += item.qtyReserved;
        colorMap.set(colorVal, entry);
      }
    }

    const sizeBreakdown = Array.from(sizeMap.entries())
      .map(([value, data]) => ({ value, ...data }))
      .sort((a, b) => {
        const aNum = parseInt(a.value);
        const bNum = parseInt(b.value);
        return isNaN(aNum) || isNaN(bNum) ? a.value.localeCompare(b.value) : aNum - bNum;
      });

    const colorBreakdown = Array.from(colorMap.entries())
      .map(([value, data]) => ({ value, ...data }))
      .sort((a, b) => a.value.localeCompare(b.value));

    return {
      name: itemsInGroup[0].name, // Use original casing from first item
      items: itemsInGroup,
      totalQty,
      totalReserved,
      sizeBreakdown,
      colorBreakdown,
    };
  });
}

export function filterItemsByStatus(
  items: WarehouseItem[],
  status: 'all' | 'instock' | 'reserved' | 'empty',
): WarehouseItem[] {
  if (status === 'all') return items;
  if (status === 'instock') return items.filter(item => item.qty > 0 && item.qtyReserved === 0);
  if (status === 'reserved') return items.filter(item => item.qtyReserved > 0);
  if (status === 'empty') return items.filter(item => item.qty === 0);
  return items;
}
