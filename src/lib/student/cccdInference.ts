import { getCommunesByProvinceName } from "@/lib/catalogs/administrative";

const cccdToProvinceMap: Record<string, string> = {
  '001': 'Hà Nội',
  '004': 'Cao Bằng',
  '011': 'Điện Biên',
  '012': 'Lai Châu',
  '014': 'Sơn La',
  '020': 'Lạng Sơn',
  '022': 'Quảng Ninh',
  '038': 'Thanh Hóa',
  '040': 'Nghệ An',
  '042': 'Hà Tĩnh',
  '046': 'Huế',
  '008': 'Tuyên Quang', '002': 'Tuyên Quang',
  '010': 'Lào Cai', '015': 'Lào Cai',
  '019': 'Thái Nguyên', '006': 'Thái Nguyên',
  '025': 'Phú Thọ', '026': 'Phú Thọ', '017': 'Phú Thọ',
  '027': 'Bắc Ninh', '024': 'Bắc Ninh',
  '033': 'Hưng Yên', '034': 'Hưng Yên',
  '031': 'Hải Phòng', '030': 'Hải Phòng',
  '037': 'Ninh Bình', '035': 'Ninh Bình', '036': 'Ninh Bình',
  '045': 'Quảng Trị', '044': 'Quảng Trị',
  '048': 'Đà Nẵng', '049': 'Đà Nẵng',
  '051': 'Quảng Ngãi', '062': 'Quảng Ngãi',
  '064': 'Gia Lai', '052': 'Gia Lai',
  '056': 'Khánh Hòa', '058': 'Khánh Hòa',
  '068': 'Lâm Đồng', '067': 'Lâm Đồng', '060': 'Lâm Đồng',
  '066': 'Đắk Lắk', '054': 'Đắk Lắk',
  '079': 'Thành phố Hồ Chí Minh', '077': 'Thành phố Hồ Chí Minh', '074': 'Thành phố Hồ Chí Minh',
  '075': 'Đồng Nai', '070': 'Đồng Nai',
  '072': 'Tây Ninh', '080': 'Tây Ninh',
  '092': 'Cần Thơ', '093': 'Cần Thơ', '094': 'Cần Thơ',
  '086': 'Vĩnh Long', '083': 'Vĩnh Long', '084': 'Vĩnh Long',
  '087': 'Đồng Tháp', '082': 'Đồng Tháp',
  '096': 'Cà Mau', '095': 'Cà Mau',
  '089': 'An Giang', '091': 'An Giang'
};

// Compatibility list used by CCCD inference. The UI uses the official template
// catalogue directly, where names retain the full administrative prefix.
export const PROVINCES_34 = [...new Set(Object.values(cccdToProvinceMap))];

export function inferProvinceFromCccd(cccd: string | undefined | null): string | null {
  if (!cccd || cccd.length < 3) return null;
  const prefix = cccd.substring(0, 3);
  return cccdToProvinceMap[prefix] || null;
}

// Kept for existing callers; every option comes from the official template catalogue.
export function getDummyCommunes(province: string): string[] {
  return getCommunesByProvinceName(province).map((commune) => commune.name);
}
