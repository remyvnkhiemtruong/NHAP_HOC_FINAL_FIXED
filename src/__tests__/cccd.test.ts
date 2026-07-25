import { inferProvinceFromCccd, PROVINCES_34 } from '../lib/student/cccdInference';

describe('CCCD Inference', () => {
  it('should infer province correctly from 3-digit prefix', () => {
    expect(inferProvinceFromCccd('001099123456')).toBe('Hà Nội');
    expect(inferProvinceFromCccd('096123456789')).toBe('Cà Mau');
    expect(inferProvinceFromCccd('095123456789')).toBe('Cà Mau');
    expect(inferProvinceFromCccd('079123')).toBe('Thành phố Hồ Chí Minh');
  });

  it('should return null for invalid or missing prefixes', () => {
    expect(inferProvinceFromCccd('999123456789')).toBeNull();
    expect(inferProvinceFromCccd('00')).toBeNull();
    expect(inferProvinceFromCccd('')).toBeNull();
    expect(inferProvinceFromCccd(null)).toBeNull();
  });
  
  it('all mapped provinces should exist in PROVINCES_34 list', () => {
    const testCases = ['001', '011', '095', '068'];
    testCases.forEach(prefix => {
      const province = inferProvinceFromCccd(prefix);
      expect(PROVINCES_34).toContain(province);
    });
  });
});
