import { describe, expect, it } from 'vitest';
import { resolvePurchaseFieldOptions } from './catalog';

describe('purchase catalog option resolution', () => {
  const productMap = {
    Chapan: [
      {
        code: 'color',
        label: 'Цвет',
        inputType: 'select' as const,
        isRequired: false,
        affectsAvailability: true,
        options: [
          { value: 'burgundy', label: 'Бордовый' },
          { value: 'ivory', label: 'Айвори' },
        ],
      },
    ],
  };

  it('prefers product-specific options over global warehouse options', () => {
    const options = resolvePurchaseFieldOptions({
      productMap,
      productName: 'Chapan',
      code: 'color',
      globalOptions: ['Черный', 'Белый'],
    });

    expect(options).toEqual(['Бордовый', 'Айвори']);
  });

  it('falls back to global options when the product has no linked field', () => {
    const options = resolvePurchaseFieldOptions({
      productMap,
      productName: 'Unknown product',
      code: 'size',
      globalOptions: ['44', '46', '48'],
    });

    expect(options).toEqual(['44', '46', '48']);
  });
});
