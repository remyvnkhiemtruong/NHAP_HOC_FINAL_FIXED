import { normalizePhone, isValidPhone } from '../lib/validations/phoneValidator';

describe('Phone Validator', () => {
  it('should normalize phones correctly', () => {
    expect(normalizePhone('+84981234567')).toBe('0981234567');
    expect(normalizePhone('098 123 4567')).toBe('0981234567');
    expect(normalizePhone('098-123-4567')).toBe('0981234567');
    expect(normalizePhone('+84 98 123 45 67')).toBe('0981234567');
  });

  it('should validate 10 digits', () => {
    expect(isValidPhone('0981234567')).toBe(true);
    expect(isValidPhone('098123456')).toBe(false); // 9 digits
    expect(isValidPhone('09812345678')).toBe(false); // 11 digits
  });

  it('should block spam numbers', () => {
    expect(isValidPhone('0000000000')).toBe(false);
    expect(isValidPhone('1111111111')).toBe(false);
    expect(isValidPhone('0123456789')).toBe(false);
    expect(isValidPhone('0987654321')).toBe(false);
  });

  it('should validate prefixes correctly', () => {
    // Viettel
    expect(isValidPhone('0981234567')).toBe(true);
    // Vina
    expect(isValidPhone('0911234567')).toBe(true);
    // Mobi
    expect(isValidPhone('0901234567')).toBe(true);
    // VNSKY 0777
    expect(isValidPhone('0777123456')).toBe(true);
    
    // Gmobile 099
    expect(isValidPhone('0999123456')).toBe(true);
    // Invalid prefixes
    expect(isValidPhone('0951234567')).toBe(false); // 095 is not in the list
    // The requirement says "099 Tiền tố chung".
    // "0993 Tiền tố chi tiết; ưu tiên so khớp trước 099".
    // So 0999 is technically valid since it starts with 099.
  });
});
