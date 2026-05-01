import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChapanPurchasePage from './ChapanPurchase';

const useManualInvoicesMock = vi.fn();
const deleteMutateMock = vi.fn();
const downloadMock = vi.fn();
const triggerBrowserDownloadMock = vi.fn();
const getFilenameFromContentDispositionMock = vi.fn(() => 'zakup_MN-0001.xlsx');

vi.mock('../../../../entities/purchase/queries', () => ({
  useManualInvoices: (type?: string) => useManualInvoicesMock(type),
  useDeleteManualInvoice: () => ({ mutate: deleteMutateMock }),
}));

vi.mock('../../../../entities/purchase/api', () => ({
  purchaseApi: {
    download: (...args: unknown[]) => downloadMock(...args),
  },
}));

vi.mock('../../../../shared/lib/browserDownload', () => ({
  triggerBrowserDownload: (...args: unknown[]) => triggerBrowserDownloadMock(...args),
  getFilenameFromContentDisposition: (...args: unknown[]) => getFilenameFromContentDispositionMock(...args),
}));

vi.mock('./ManualInvoiceForm', () => ({
  default: () => null,
}));

describe('ChapanPurchasePage', () => {
  beforeEach(() => {
    useManualInvoicesMock.mockReset();
    deleteMutateMock.mockReset();
    downloadMock.mockReset();
    triggerBrowserDownloadMock.mockReset();
    getFilenameFromContentDispositionMock.mockClear();

    useManualInvoicesMock.mockImplementation((type?: string) => ({
      data: {
        count: type === 'workshop' ? 1 : 0,
        results: type === 'workshop'
          ? [{
              id: 'invoice-1',
              orgId: 'org-1',
              type: 'workshop',
              invoiceNum: 'MN-0001',
              title: 'Test purchase',
              notes: null,
              createdById: 'user-1',
              createdByName: 'Owner',
              createdAt: '2026-04-29T10:00:00.000Z',
              items: [
                {
                  id: 'item-1',
                  productName: 'Chapan',
                  quantity: 2,
                  unitPrice: 1000,
                },
              ],
            }]
          : [],
      },
      isLoading: false,
      isError: false,
    }));
  });

  it('downloads purchase files via blob flow instead of window.open', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    downloadMock.mockResolvedValue({
      data: new Blob(['xlsx'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      headers: {
        'content-disposition': "attachment; filename*=UTF-8''zakup_MN-0001.xlsx",
      },
    });

    render(<ChapanPurchasePage />);

    await user.click(screen.getByRole('button', { name: /xlsx/i }));

    await waitFor(() => {
      expect(downloadMock).toHaveBeenCalledWith('invoice-1', 'KZT');
    });
    expect(openSpy).not.toHaveBeenCalled();
    expect(getFilenameFromContentDispositionMock).toHaveBeenCalled();
    expect(triggerBrowserDownloadMock).toHaveBeenCalledTimes(1);

    openSpy.mockRestore();
  });
});
