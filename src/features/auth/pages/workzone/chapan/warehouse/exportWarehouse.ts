import type { Alignment, Borders, Cell, Fill, Workbook, Worksheet } from 'exceljs';
import { warehouseApi } from '@/entities/warehouse/api';
import type { WarehouseItem, WarehouseSummary } from '@/entities/warehouse/types';
import { useAuthStore } from '../../../../shared/stores/auth';

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const COLORS = {
  brand: 'FF1A6B3C',
  brandDark: 'FF0F4A27',
  brandSoft: 'FFE6F4EC',
  brandAlt: 'FFF4FAF6',
  white: 'FFFFFFFF',
  text: 'FF101828',
  muted: 'FF475467',
  border: 'FFD0D5DD',
  borderAccent: 'FF9FCFB4',
  ok: 'FF027A48',
  okSoft: 'FFECFDF3',
  reserve: 'FFB54708',
  reserveSoft: 'FFFFF4E5',
  warning: 'FFB42318',
  warningSoft: 'FFFEE4E2',
  empty: 'FF667085',
  emptySoft: 'FFF2F4F7',
};

type StockTone = 'ok' | 'reserve' | 'warning' | 'empty';

interface ExportRow {
  index: number;
  name: string;
  sku: string;
  characteristics: string;
  category: string;
  unit: string;
  qty: number;
  reserved: number;
  available: number;
  minQty: number;
  price: number | null;
  lineValue: number | null;
  status: string;
  statusTone: StockTone;
  notes: string;
}

interface ExportMetrics {
  positionCount: number;
  categoryCount: number;
  totalQty: number;
  totalReserved: number;
  totalAvailable: number;
  lowStockCount: number;
  totalValue: number;
}

interface MetricCard {
  label: string;
  value: string;
  fill: string;
  color: string;
}

function thinBorder(color: string): Partial<Borders> {
  const edge = { style: 'thin' as const, color: { argb: color } };
  return { top: edge, right: edge, bottom: edge, left: edge };
}

function solidFill(argb: string): Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function currencyHeader(currency: string) {
  return currency.toUpperCase() === 'KZT' ? 'Цена, тг' : `Цена, ${currency.toUpperCase()}`;
}

function amountHeader(currency: string) {
  return currency.toUpperCase() === 'KZT' ? 'Сумма, тг' : `Сумма, ${currency.toUpperCase()}`;
}

function getAvailableQty(item: WarehouseItem) {
  return item.qty - item.qtyReserved;
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTimeLabel(date: Date) {
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFileDate(date: Date) {
  return date.toLocaleDateString('ru-RU').replace(/\./g, '-');
}

function formatInteger(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMoney(value: number, currency: string) {
  return `${formatInteger(value)} ${currency.toUpperCase() === 'KZT' ? 'тг' : currency.toUpperCase()}`;
}

function getStatusDescriptor(item: WarehouseItem): { label: string; tone: StockTone } {
  const available = getAvailableQty(item);

  if (item.qty <= 0 || available <= 0) {
    return { label: 'Нет в наличии', tone: 'empty' };
  }

  if (available <= item.qtyMin) {
    return { label: 'Ниже минимума', tone: 'warning' };
  }

  if (item.qtyReserved > 0) {
    return { label: 'Есть резерв', tone: 'reserve' };
  }

  return { label: 'В норме', tone: 'ok' };
}

function getStatusPalette(tone: StockTone) {
  switch (tone) {
    case 'warning':
      return { fill: COLORS.warningSoft, font: COLORS.warning };
    case 'reserve':
      return { fill: COLORS.reserveSoft, font: COLORS.reserve };
    case 'empty':
      return { fill: COLORS.emptySoft, font: COLORS.empty };
    case 'ok':
    default:
      return { fill: COLORS.okSoft, font: COLORS.ok };
  }
}

function buildCharacteristics(item: WarehouseItem) {
  const attrs = item.attributesJson ?? {};
  const fields = [
    ['Цвет', attrs.color],
    ['Размер', attrs.size],
    ['Длина', attrs.length],
    ['Пол', attrs.gender],
  ].filter(([, value]) => typeof value === 'string' && value.trim().length > 0) as Array<[string, string]>;

  if (fields.length > 0) {
    return fields.map(([label, value]) => `${label}: ${value}`).join('\n');
  }

  if (item.attributesSummary?.trim()) {
    return item.attributesSummary.trim();
  }

  return '—';
}

function buildExportRows(items: WarehouseItem[]): ExportRow[] {
  return items.map((item, index) => {
    const available = getAvailableQty(item);
    const descriptor = getStatusDescriptor(item);
    const price = typeof item.costPrice === 'number' ? item.costPrice : null;

    return {
      index: index + 1,
      name: item.name,
      sku: item.sku?.trim() || '—',
      characteristics: buildCharacteristics(item),
      category: item.category?.name?.trim() || 'Без категории',
      unit: item.unit,
      qty: item.qty,
      reserved: item.qtyReserved,
      available,
      minQty: item.qtyMin,
      price,
      lineValue: price === null ? null : item.qty * price,
      status: descriptor.label,
      statusTone: descriptor.tone,
      notes: item.notes?.trim() || '—',
    };
  });
}

function buildMetrics(rows: ExportRow[], summary: WarehouseSummary | null): ExportMetrics {
  const totalQty = rows.reduce((sum, row) => sum + row.qty, 0);
  const totalReserved = rows.reduce((sum, row) => sum + row.reserved, 0);
  const totalAvailable = rows.reduce((sum, row) => sum + row.available, 0);
  const totalValue = rows.reduce((sum, row) => sum + (row.lineValue ?? 0), 0);
  const categoryCount = new Set(rows.map((row) => row.category)).size;
  const lowStockCount = rows.filter((row) => row.statusTone === 'warning' || row.statusTone === 'empty').length;

  return {
    positionCount: rows.length,
    categoryCount: summary?.categories ?? categoryCount,
    totalQty,
    totalReserved,
    totalAvailable,
    lowStockCount: summary?.lowStockCount ?? lowStockCount,
    totalValue: summary?.totalValue ?? totalValue,
  };
}

function applyMetaPair(
  worksheet: Worksheet,
  rowNumber: number,
  labelStartCol: number,
  labelEndCol: number,
  valueStartCol: number,
  valueEndCol: number,
  label: string,
  value: string,
) {
  worksheet.mergeCells(rowNumber, labelStartCol, rowNumber, labelEndCol);
  worksheet.mergeCells(rowNumber, valueStartCol, rowNumber, valueEndCol);

  const labelCell = worksheet.getCell(rowNumber, labelStartCol);
  labelCell.value = label;
  labelCell.font = { bold: true, size: 11, color: { argb: COLORS.text }, name: 'Calibri' };
  labelCell.fill = solidFill(COLORS.brandSoft);
  labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
  labelCell.border = thinBorder(COLORS.borderAccent);

  const valueCell = worksheet.getCell(rowNumber, valueStartCol);
  valueCell.value = value;
  valueCell.font = { size: 11, color: { argb: COLORS.text }, name: 'Calibri' };
  valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
  valueCell.border = thinBorder(COLORS.borderAccent);
}

function applyMetricCard(
  worksheet: Worksheet,
  startCol: number,
  endCol: number,
  label: string,
  value: string,
  fill: string,
  color: string,
) {
  worksheet.mergeCells(8, startCol, 8, endCol);
  worksheet.mergeCells(9, startCol, 10, endCol);

  const labelCell = worksheet.getCell(8, startCol);
  labelCell.value = label;
  labelCell.font = { size: 10, bold: true, color: { argb: COLORS.muted }, name: 'Calibri' };
  labelCell.fill = solidFill(COLORS.white);
  labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
  labelCell.border = thinBorder(COLORS.border);

  const valueCell = worksheet.getCell(9, startCol);
  valueCell.value = value;
  valueCell.font = { size: 14, bold: true, color: { argb: color }, name: 'Calibri' };
  valueCell.fill = solidFill(fill);
  valueCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  valueCell.border = thinBorder(COLORS.border);
}

async function createWorkbook(): Promise<{ workbook: Workbook; worksheet: Worksheet }> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Складская ведомость', {
    views: [{ state: 'frozen', ySplit: 11 }],
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.35, right: 0.35, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });

  worksheet.columns = [
    { key: 'index', width: 6 },
    { key: 'name', width: 28 },
    { key: 'sku', width: 16 },
    { key: 'characteristics', width: 24 },
    { key: 'category', width: 18 },
    { key: 'unit', width: 10 },
    { key: 'qty', width: 11 },
    { key: 'reserved', width: 11 },
    { key: 'available', width: 12 },
    { key: 'minQty', width: 13 },
    { key: 'price', width: 14 },
    { key: 'lineValue', width: 16 },
    { key: 'status', width: 18 },
    { key: 'notes', width: 28 },
  ];

  worksheet.properties.defaultRowHeight = 20;

  workbook.creator = 'KORT';
  workbook.lastModifiedBy = 'KORT';
  workbook.created = new Date();
  workbook.modified = new Date();

  return { workbook, worksheet };
}

function getMetricCards(metrics: ExportMetrics, currency: string): MetricCard[] {
  return [
    { label: 'Позиций', value: formatInteger(metrics.positionCount), fill: COLORS.brandSoft, color: COLORS.brandDark },
    { label: 'Категорий', value: formatInteger(metrics.categoryCount), fill: COLORS.brandAlt, color: COLORS.brandDark },
    { label: 'Остаток всего', value: formatInteger(metrics.totalQty), fill: COLORS.okSoft, color: COLORS.ok },
    { label: 'В резерве', value: formatInteger(metrics.totalReserved), fill: COLORS.reserveSoft, color: COLORS.reserve },
    { label: 'Доступно', value: formatInteger(metrics.totalAvailable), fill: COLORS.okSoft, color: COLORS.ok },
    { label: 'Риск по остатку', value: formatInteger(metrics.lowStockCount), fill: COLORS.warningSoft, color: COLORS.warning },
    { label: 'Стоимость остатка', value: formatMoney(metrics.totalValue, currency), fill: COLORS.brandSoft, color: COLORS.brandDark },
  ];
}

function applySheetHeader(
  worksheet: Worksheet,
  orgName: string,
  preparedBy: string,
  currency: string,
  now: Date,
) {
  worksheet.mergeCells(1, 1, 1, 14);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = 'Складская ведомость по остаткам';
  titleCell.font = { bold: true, size: 18, color: { argb: COLORS.brand }, name: 'Calibri' };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.mergeCells(2, 1, 2, 14);
  const subtitleCell = worksheet.getCell(2, 1);
  subtitleCell.value = `${orgName} • внутренний отчет KORT`;
  subtitleCell.font = { size: 11, color: { argb: COLORS.muted }, name: 'Calibri' };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.mergeCells(3, 1, 3, 14);
  const captionCell = worksheet.getCell(3, 1);
  captionCell.value = `Сформировано ${formatDateTimeLabel(now)} • Подготовил: ${preparedBy}`;
  captionCell.font = { size: 10, color: { argb: COLORS.muted }, name: 'Calibri' };
  captionCell.alignment = { horizontal: 'center', vertical: 'middle' };

  applyMetaPair(worksheet, 5, 1, 3, 4, 6, 'Организация', orgName);
  applyMetaPair(worksheet, 5, 7, 9, 10, 14, 'Дата выгрузки', formatDateLabel(now));
  applyMetaPair(worksheet, 6, 1, 3, 4, 6, 'Ответственный', preparedBy);
  applyMetaPair(worksheet, 6, 7, 9, 10, 14, 'Валюта', currency.toUpperCase());

  worksheet.getRow(1).height = 28;
  worksheet.getRow(2).height = 18;
  worksheet.getRow(3).height = 16;
  worksheet.getRow(4).height = 8;
  worksheet.getRow(5).height = 22;
  worksheet.getRow(6).height = 22;
  worksheet.getRow(7).height = 8;
}

function applyMetricSection(worksheet: Worksheet, metrics: ExportMetrics, currency: string) {
  const cards = getMetricCards(metrics, currency);
  cards.forEach((card, index) => {
    const startCol = index * 2 + 1;
    const endCol = startCol + 1;
    applyMetricCard(worksheet, startCol, endCol, card.label, card.value, card.fill, card.color);
  });

  worksheet.getRow(8).height = 18;
  worksheet.getRow(9).height = 24;
  worksheet.getRow(10).height = 24;
}

function styleHeaderCell(cell: Cell) {
  cell.font = { bold: true, size: 10, color: { argb: COLORS.white }, name: 'Calibri' };
  cell.fill = solidFill(COLORS.brand);
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border = thinBorder(COLORS.brandDark);
}

function applyTableHeader(worksheet: Worksheet, currency: string) {
  const headers = [
    '№',
    'Товар',
    'Артикул / SKU',
    'Характеристики',
    'Категория',
    'Ед.',
    'Остаток',
    'Резерв',
    'Доступно',
    'Мин. остаток',
    currencyHeader(currency),
    amountHeader(currency),
    'Статус',
    'Примечание',
  ];

  const headerRow = worksheet.getRow(11);
  headerRow.values = headers;
  headerRow.height = 30;

  for (let column = 1; column <= headers.length; column += 1) {
    styleHeaderCell(worksheet.getCell(11, column));
  }

  worksheet.autoFilter = {
    from: { row: 11, column: 1 },
    to: { row: 11, column: headers.length },
  };
}

function applyDataCellAlignment(columnIndex: number): Partial<Alignment> {
  if ([1, 6, 7, 8, 9, 10].includes(columnIndex)) {
    return { horizontal: 'center' };
  }

  if ([11, 12].includes(columnIndex)) {
    return { horizontal: 'right' };
  }

  return { horizontal: 'left' };
}

function populateTable(worksheet: Worksheet, rows: ExportRow[]) {
  let rowNumber = 12;

  if (rows.length === 0) {
    worksheet.mergeCells(rowNumber, 1, rowNumber, 14);
    const emptyCell = worksheet.getCell(rowNumber, 1);
    emptyCell.value = 'На складе пока нет позиций для выгрузки.';
    emptyCell.font = { italic: true, size: 11, color: { argb: COLORS.muted }, name: 'Calibri' };
    emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
    emptyCell.fill = solidFill(COLORS.emptySoft);
    emptyCell.border = thinBorder(COLORS.border);
    worksheet.getRow(rowNumber).height = 24;
    return rowNumber;
  }

  rows.forEach((row) => {
    const excelRow = worksheet.getRow(rowNumber);
    excelRow.values = [
      row.index,
      row.name,
      row.sku,
      row.characteristics,
      row.category,
      row.unit,
      row.qty,
      row.reserved,
      row.available,
      row.minQty,
      row.price,
      row.lineValue,
      row.status,
      row.notes,
    ];

    const baseFill = rowNumber % 2 === 0 ? COLORS.white : COLORS.brandAlt;
    const statusPalette = getStatusPalette(row.statusTone);

    for (let column = 1; column <= 14; column += 1) {
      const cell = worksheet.getCell(rowNumber, column);
      const isTextHeavy = column === 4 || column === 14;

      cell.font = { size: 10, color: { argb: COLORS.text }, name: 'Calibri' };
      cell.fill = solidFill(baseFill);
      cell.alignment = {
        ...applyDataCellAlignment(column),
        vertical: 'middle',
        wrapText: isTextHeavy,
      };
      cell.border = thinBorder(COLORS.border);

      if ([7, 8, 9, 10].includes(column)) {
        cell.numFmt = '#,##0.##';
      }

      if ([11, 12].includes(column)) {
        cell.numFmt = '#,##0.00';
      }
    }

    const availableCell = worksheet.getCell(rowNumber, 9);
    availableCell.font = {
      size: 10,
      bold: row.statusTone === 'warning' || row.statusTone === 'empty',
      color: { argb: statusPalette.font },
      name: 'Calibri',
    };

    const statusCell = worksheet.getCell(rowNumber, 13);
    statusCell.fill = solidFill(statusPalette.fill);
    statusCell.font = { size: 10, bold: true, color: { argb: statusPalette.font }, name: 'Calibri' };
    statusCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    excelRow.height = row.characteristics.includes('\n') || row.notes.length > 30 ? 34 : 24;
    rowNumber += 1;
  });

  return rowNumber - 1;
}

function applyTotalsSection(worksheet: Worksheet, totalsRowNumber: number, metrics: ExportMetrics) {
  worksheet.mergeCells(totalsRowNumber, 1, totalsRowNumber, 6);

  const labelCell = worksheet.getCell(totalsRowNumber, 1);
  labelCell.value = 'ИТОГО ПО СКЛАДУ';
  labelCell.font = { size: 11, bold: true, color: { argb: COLORS.white }, name: 'Calibri' };
  labelCell.fill = solidFill(COLORS.brandDark);
  labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
  labelCell.border = thinBorder(COLORS.brandDark);

  const totals = [
    { column: 7, value: metrics.totalQty, format: '#,##0.##' },
    { column: 8, value: metrics.totalReserved, format: '#,##0.##' },
    { column: 9, value: metrics.totalAvailable, format: '#,##0.##' },
    { column: 10, value: '', format: undefined },
    { column: 11, value: '', format: undefined },
    { column: 12, value: metrics.totalValue, format: '#,##0.00' },
  ];

  totals.forEach(({ column, value, format }) => {
    const cell = worksheet.getCell(totalsRowNumber, column);
    cell.value = value;
    cell.font = { size: 11, bold: true, color: { argb: COLORS.text }, name: 'Calibri' };
    cell.fill = solidFill(COLORS.brandSoft);
    cell.alignment = { horizontal: column === 12 ? 'right' : 'center', vertical: 'middle' };
    cell.border = thinBorder(COLORS.borderAccent);
    if (format) {
      cell.numFmt = format;
    }
  });

  for (let column = 13; column <= 14; column += 1) {
    const cell = worksheet.getCell(totalsRowNumber, column);
    cell.value = '';
    cell.fill = solidFill(COLORS.brandSoft);
    cell.border = thinBorder(COLORS.borderAccent);
  }

  worksheet.getRow(totalsRowNumber).height = 24;
}

function applyFooter(
  worksheet: Worksheet,
  footerRow: number,
  preparedBy: string,
) {
  worksheet.mergeCells(footerRow, 1, footerRow, 8);
  worksheet.mergeCells(footerRow, 9, footerRow, 14);

  const legendCell = worksheet.getCell(footerRow, 1);
  legendCell.value = 'Статусы: Нет в наличии / Ниже минимума / Есть резерв / В норме';
  legendCell.font = { size: 10, color: { argb: COLORS.muted }, name: 'Calibri' };
  legendCell.alignment = { horizontal: 'left', vertical: 'middle' };

  const preparedCell = worksheet.getCell(footerRow, 9);
  preparedCell.value = `Подготовил: ${preparedBy}`;
  preparedCell.font = { size: 10, color: { argb: COLORS.muted }, name: 'Calibri' };
  preparedCell.alignment = { horizontal: 'right', vertical: 'middle' };

  worksheet.getRow(footerRow).height = 20;
}

async function downloadWorkbook(workbook: Workbook, fileName: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: MIME_XLSX });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function exportWarehouseToExcel(): Promise<void> {
  const now = new Date();
  const auth = useAuthStore.getState();
  const orgName = auth.org?.name || auth.membership.companyName || 'Организация';
  const preparedBy = auth.user?.full_name?.trim() || 'Сотрудник склада';
  const currency = auth.org?.currency || 'KZT';

  const [itemsResponse, summary] = await Promise.all([
    warehouseApi.listItems({ limit: 9999 }),
    warehouseApi.getSummary().catch(() => null),
  ]);

  const rows = buildExportRows(itemsResponse.results ?? []);
  const metrics = buildMetrics(rows, summary);
  const { workbook, worksheet } = await createWorkbook();

  workbook.title = 'Складская ведомость';
  workbook.subject = 'Экспорт складских остатков';
  workbook.description = `Складская ведомость ${orgName} от ${formatDateLabel(now)}`;

  applySheetHeader(worksheet, orgName, preparedBy, currency, now);
  applyMetricSection(worksheet, metrics, currency);
  applyTableHeader(worksheet, currency);

  const lastDataRow = populateTable(worksheet, rows);
  const totalsRowNumber = lastDataRow + 2;
  const footerRow = totalsRowNumber + 2;

  if (rows.length > 0) {
    applyTotalsSection(worksheet, totalsRowNumber, metrics);
  }

  applyFooter(worksheet, footerRow, preparedBy);

  await downloadWorkbook(workbook, `Складская_ведомость_${formatFileDate(now)}.xlsx`);
}
