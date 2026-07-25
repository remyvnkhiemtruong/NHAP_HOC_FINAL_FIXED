import { studentSchema } from '../lib/validations/studentSchema';

describe('studentSchema', () => {
  const baseData = {
    C: 'Nguyễn Văn A',
    F: '01/01/2010',
    G: 'Nam',
    W: 'Kinh',
    L: 'Hà Nội',
    BF: '012210123456',
    AK: 'Cha',
    AQ: 'Mẹ',
    AF: '0981234567',
    AJ: 'Có'
  };

  it('should format names correctly', () => {
    const data = { ...baseData, C: 'Nguyễn    Văn   A ' };
    const parsed = studentSchema.parse(data);
    expect(parsed.C).toBe('Nguyễn Văn A');
  });

  it('should format email correctly', () => {
    const data = { ...baseData, BI: '  ABC@gmail.Com ' };
    const parsed = studentSchema.parse(data);
    expect(parsed.BI).toBe('abc@gmail.com');
  });

  it('should validate phones correctly', () => {
    const data = { ...baseData, AF: '+84981234567' };
    const parsed = studentSchema.parse(data);
    expect(parsed.AF).toBe('0981234567');
  });

  it('should require guardian if no father and mother', () => {
    const data = {
      ...baseData,
      cha_da_mat: true,
      me_da_mat: true,
      AF: '0981234567', // at least one phone
      AW: ''
    };
    const result = studentSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('AW'))).toBe(true);
    }
  });

  it('should require at least one phone', () => {
    const data = {
      ...baseData,
      AK: 'Cha',
      AQ: 'Mẹ',
      AF: '',
      AN: '',
      AT: '',
      AZ: ''
    };
    const result = studentSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('AF'))).toBe(true);
    }
  });

  it('should reject invalid ethnicity', () => {
    const data = { ...baseData, W: 'Dân tộc lạ' };
    const result = studentSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('W'))).toBe(true);
    }
  });

  it('should reject invalid religion', () => {
    const data = { ...baseData, X: 'Tôn giáo lạ' };
    const result = studentSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('X'))).toBe(true);
    }
  });

  it('should require doi date if is_doi_vien', () => {
    const data = { ...baseData, is_doi_vien: true, V: '' };
    const result = studentSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('V'))).toBe(true);
    }
  });

  it('should require Y and Z if has_policy', () => {
    const data = { ...baseData, has_policy: true, Y: '', Z: '' };
    const result = studentSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('Y'))).toBe(true);
      expect(result.error.issues.some(i => i.path.includes('Z'))).toBe(true);
    }
  });

  it('should reject invalid disability AE', () => {
    const data = { ...baseData, AE: 'Khuyết tật lạ' };
    const result = studentSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('AE'))).toBe(true);
    }
  });

  it('should reject invalid blood type AH', () => {
    const data = { ...baseData, AH: 'C' };
    const result = studentSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('AH'))).toBe(true);
    }
  });

  it('should reject invalid swimming AJ', () => {
    const data = { ...baseData, AJ: 'Biết sương sương' };
    const result = studentSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('AJ'))).toBe(true);
    }
  });
});
