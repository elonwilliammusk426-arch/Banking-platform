export const KYC_PROVIDER = Symbol('KYC_PROVIDER');
export const CARD_PROVIDER = Symbol('CARD_PROVIDER');
export const BANK_RAIL_PROVIDER = Symbol('BANK_RAIL_PROVIDER');
export const MESSAGE_PROVIDER = Symbol('MESSAGE_PROVIDER');

export interface KycProvider {
  submit(input: { customerId: string; encryptedPayload: string; documentIds: string[] }): Promise<{ reference: string; status: 'IN_REVIEW' | 'APPROVED' }>;
}
export interface CardProvider {
  issue(input: { customerId: string; accountId: string; type: 'VIRTUAL' | 'PHYSICAL'; name: string }): Promise<{ reference: string; last4: string; network: string; expiryMonth: number; expiryYear: number }>;
  updateStatus(reference: string, action: 'activate' | 'freeze' | 'unfreeze' | 'cancel'): Promise<void>;
}
export interface BankRailProvider {
  initiate(input: { transferId: string; rail: 'ACH' | 'WIRE'; amount: string; currency: string; encryptedDestination: string }): Promise<{ reference: string; status: 'PROCESSING' | 'COMPLETED' }>;
}
export interface MessageProvider {
  send(input: { channel: 'EMAIL' | 'PHONE' | 'PUSH'; destination: string; template: string; variables: Record<string, string> }): Promise<{ reference: string }>;
}
