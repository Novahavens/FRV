import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCOUNT_MANAGERS } from '@/lib/account-managers';
import { isAccountManager } from '@/lib/account-managers-match';

describe('isAccountManager', () => {
  it('accepts an exact name', () => {
    expect(isAccountManager('Lou', DEFAULT_ACCOUNT_MANAGERS)).toBe(true);
  });
  it('trims surrounding whitespace', () => {
    expect(isAccountManager('  Keti ', DEFAULT_ACCOUNT_MANAGERS)).toBe(true);
  });
  it('rejects unknown, empty and near-miss names', () => {
    expect(isAccountManager('Someone Else', DEFAULT_ACCOUNT_MANAGERS)).toBe(false);
    expect(isAccountManager('', DEFAULT_ACCOUNT_MANAGERS)).toBe(false);
    expect(isAccountManager('dian', DEFAULT_ACCOUNT_MANAGERS)).toBe(false);
    expect(isAccountManager('Mel', [])).toBe(false);
  });
});
