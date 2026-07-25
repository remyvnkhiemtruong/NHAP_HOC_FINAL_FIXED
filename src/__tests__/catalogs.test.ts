import { ETHNICITIES } from '../lib/catalogs/ethnicities';
import { RELIGIONS } from '../lib/catalogs/religions';
import { DROPDOWNS } from '../lib/catalogs/dropdowns';
import { PHONE_PREFIXES, getOperator } from '../lib/catalogs/phone-prefixes';
import { CCCD_63_CODES } from '../lib/catalogs/cccd-63-codes';
import { CCCD_34_CURRENT_MAPPING } from '../lib/catalogs/cccd-34-mapping';

describe('Reference Catalogs', () => {
  it('should have exactly 54 ethnicities', () => {
    expect(ETHNICITIES).toHaveLength(54);
    // Check first and last
    expect(ETHNICITIES[0].name).toBe('Kinh');
    expect(ETHNICITIES[53].name).toBe('Rơ măm');
  });

  it('should have exactly 17 religions', () => {
    expect(RELIGIONS).toHaveLength(17);
    expect(RELIGIONS.find(r => r.code === 'PG')?.name).toBe('Phật giáo');
    expect(RELIGIONS.find(r => r.code === 'KHONG')?.name).toBe('Không');
  });

  it('should have expected dropdown groups', () => {
    expect(DROPDOWNS.classes).toHaveLength(40);
    expect(DROPDOWNS.admissionMethods).toHaveLength(3);
    expect(DROPDOWNS.policyObjects).toHaveLength(16);
    expect(DROPDOWNS.policyRegimes).toHaveLength(3);
    expect(DROPDOWNS.studentStatuses).toHaveLength(14);
    expect(DROPDOWNS.studentTypes).toHaveLength(5);
    expect(DROPDOWNS.areas).toHaveLength(4);
    expect(DROPDOWNS.disabilityTypes).toHaveLength(6);
    expect(DROPDOWNS.lowerGraduationTypes).toHaveLength(3);
    expect(DROPDOWNS.foreignLanguageYears).toHaveLength(4);
    expect(DROPDOWNS.priorityTypes).toHaveLength(19);
    expect(DROPDOWNS.vocationalTraining).toHaveLength(5);
    expect(DROPDOWNS.sessionsPerWeek).toHaveLength(6);
    expect(DROPDOWNS.boardingReasons).toHaveLength(2);
    expect(DROPDOWNS.bloodTypes).toHaveLength(5);
    expect(DROPDOWNS.yesNo).toHaveLength(2);
    expect(DROPDOWNS.genders).toHaveLength(2);
  });

  it('should resolve phone prefixes correctly', () => {
    expect(PHONE_PREFIXES.length).toBeGreaterThan(40);

    // VNSKY vs MobiFone collision test
    expect(getOperator('0777123456')).toBe('VNSKY');
    expect(getOperator('0775123456')).toBe('FPT');
    expect(getOperator('0776123456')).toBe('MobiFone');

    // Gmobile detail test
    expect(getOperator('0592123456')).toBe('Gmobile');
    expect(getOperator('0591123456')).toBe('Gmobile');
    expect(getOperator('0993123456')).toBe('Gmobile');
    
    // Viettel test
    expect(getOperator('0321234567')).toBe('Viettel');

    // iTel test
    expect(getOperator('0871234567')).toBe('iTel');

    // Invalid length
    expect(getOperator('077712345')).toBeNull();
  });

  it('should have 63 CCCD codes', () => {
    expect(Object.keys(CCCD_63_CODES)).toHaveLength(63);
    expect(CCCD_63_CODES['001']).toBe('Hà Nội');
    expect(CCCD_63_CODES['096']).toBe('Cà Mau');
  });

  it('should have 34 current provinces mapped to legacy CCCD', () => {
    expect(CCCD_34_CURRENT_MAPPING).toHaveLength(34);
    
    const hanoi = CCCD_34_CURRENT_MAPPING.find(m => m.currentProvince === 'Hà Nội');
    expect(hanoi?.acceptedLegacyCodes).toEqual(['001']);

    const phutho = CCCD_34_CURRENT_MAPPING.find(m => m.currentProvince === 'Phú Thọ');
    expect(phutho?.acceptedLegacyCodes).toEqual(['025', '026', '017']);
  });
});
