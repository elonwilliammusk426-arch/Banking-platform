import { base32Encode, verifyTotp } from './totp';

describe('TOTP', () => {
  const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  it('encodes the RFC test secret as base32', () => {
    expect(base32Encode(Buffer.from('12345678901234567890'))).toBe(rfcSecret);
  });

  it('accepts the RFC 6238 value truncated to six digits', () => {
    expect(verifyTotp(rfcSecret, '287082', 59_000)).toBe(true);
  });

  it('accepts one adjacent 30-second window and rejects unrelated codes', () => {
    expect(verifyTotp(rfcSecret, '287082', 89_000)).toBe(true);
    expect(verifyTotp(rfcSecret, '000000', 59_000)).toBe(false);
  });
});
