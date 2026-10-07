import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCOUNT_MANAGERS } from '@/lib/account-managers';
import { isAccountManager } from '@/lib/account-managers-match';

describe('isAccountManager', () => {
  it('accepts an exact name', () => {
    expect(isAccountManager('Louise Jaffe', DEFAULT_ACCOUNT_MANAGERS)).toBe(true);
  });
  it('trims surrounding whitespace', () => {
    expect(isAccountManager('  William ', DEFAULT_ACCOUNT_MANAGERS)).toBe(true);
  });
  it('rejects unknown, empty and near-miss names', () => {
    expect(isAccountManager('Someone Else', DEFAULT_ACCOUNT_MANAGERS)).toBe(false);
    expect(isAccountManager('', DEFAULT_ACCOUNT_MANAGERS)).toBe(false);
    expect(isAccountManager('fazal abed', DEFAULT_ACCOUNT_MANAGERS)).toBe(false);
    expect(isAccountManager('William', [])).toBe(false);
  });
});
