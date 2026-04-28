export interface BatchPublic {
  id: string;
  payrocBatchId: string;
  merchantId: string;
  totalAmount: number;
  totalFeesCustomer: number;
  transactionCount: number;
  status: string;
  openedAt: string;
  closedAt: string | null;
  settledAt: string | null;
  createdAt: string;
}

export interface PayoutPublic {
  id: string;
  merchantId: string;
  amount: number;
  currency: string;
  status: string;
  arrivalDate: string | null;
  description: string | null;
  batchId: string | null;
  createdAt: string;
}

export interface MasterPayoutRow extends PayoutPublic {
  merchantBusinessName: string;
}

export interface PayoutListResponse {
  data: PayoutPublic[];
  count: number;
  totalAmount: number;
}

export interface MasterPayoutListResponse {
  data: MasterPayoutRow[];
  count: number;
  totalAmount: number;
  merchantsRepresented: number;
}

export interface SyncResult {
  merchantId: string;
  batchesProcessed: number;
  payoutsCreated: number;
  errors: string[];
}
