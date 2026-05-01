export type PurchaseType = 'workshop' | 'market';

export interface ManualInvoiceItem {
  id: string;
  productName: string;
  gender?: string | null;
  length?: string | null;
  color?: string | null;
  size?: string | null;
  quantity: number;
  unitPrice: number;
}

export interface ManualInvoice {
  id: string;
  orgId: string;
  type: PurchaseType;
  invoiceNum: string;
  title: string;
  notes?: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  items: ManualInvoiceItem[];
}

export interface CreateManualInvoiceDto {
  type: PurchaseType;
  title: string;
  notes?: string;
  items: Array<{
    productName: string;
    gender?: string;
    length?: string;
    color?: string;
    size?: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface UpdateManualInvoiceDto {
  title?: string;
  notes?: string;
  items?: Array<{
    productName: string;
    gender?: string;
    length?: string;
    color?: string;
    size?: string;
    quantity: number;
    unitPrice: number;
  }>;
}
