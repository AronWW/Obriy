import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
} from '../../../../src/common/validation/password.validation';

describe('Obriy password policy', () => {
  it.each(['StrongPassword123!', 'історія України 2026', 'pass phrase 123'])(
    'accepts a valid password: %s',
    (password) => {
      expect(password.length).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH);
      expect(password.length).toBeLessThanOrEqual(PASSWORD_MAX_LENGTH);
      expect(PASSWORD_PATTERN.test(password)).toBe(true);
    },
  );

  it.each(['onlyletters', '1234567890', 'Short1'])('rejects %s', (password) => {
    const validLength =
      password.length >= PASSWORD_MIN_LENGTH &&
      password.length <= PASSWORD_MAX_LENGTH;
    expect(validLength && PASSWORD_PATTERN.test(password)).toBe(false);
  });
});
