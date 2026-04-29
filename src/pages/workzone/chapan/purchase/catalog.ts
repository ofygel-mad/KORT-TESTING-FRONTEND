import type { OrderFormCatalog, OrderFormField, WarehouseFieldDefinition } from '../../../../entities/warehouse/types';

export type PurchaseProductFieldMap = Record<string, OrderFormField[]>;

export function buildPurchaseProductFieldMap(catalog?: OrderFormCatalog): PurchaseProductFieldMap {
  const productMap: PurchaseProductFieldMap = {};

  for (const product of catalog?.products ?? []) {
    productMap[product.name] = product.fields;
  }

  return productMap;
}

export function getGlobalWarehouseOptions(
  definitions: WarehouseFieldDefinition[] | undefined,
  code: string,
): string[] {
  return definitions?.find((definition) => definition.code === code)?.options.map((option) => option.label) ?? [];
}

export function getProductFieldOptions(
  productMap: PurchaseProductFieldMap,
  productName: string,
  code: string,
): string[] {
  const field = productMap[productName]?.find((entry) => entry.code === code);
  return field?.options.map((option) => option.label) ?? [];
}

export function resolvePurchaseFieldOptions(args: {
  productMap: PurchaseProductFieldMap;
  productName: string;
  code: string;
  globalOptions: string[];
}): string[] {
  const specificOptions = getProductFieldOptions(args.productMap, args.productName, args.code);
  return specificOptions.length > 0 ? specificOptions : args.globalOptions;
}
