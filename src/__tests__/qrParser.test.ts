import { parseCccdQr } from '../lib/cccd/qrParser';

describe('CCCD QR Parser', () => {
  it.each([
    [
      '079210123456|024123456|NGUYEN VAN A|15/10/2010|Nam|Phường 1, Quận 1, TP.HCM|01/01/2025',
      {
        cccd: '079210123456',
        oldId: '024123456',
        fullName: 'NGUYEN VAN A',
        dob: '15/10/2010',
        gender: 'Nam',
        address: 'Phường 1, Quận 1, TP.HCM',
        issueDate: '01/01/2025'
      }
    ],
    [
      '079210123456||NGUYEN VAN B|10/10/2010|Nữ|Hà Nội|01/01/2025', // No old ID
      {
        cccd: '079210123456',
        oldId: '',
        fullName: 'NGUYEN VAN B',
        dob: '10/10/2010',
        gender: 'Nữ',
        address: 'Hà Nội',
        issueDate: '01/01/2025'
      }
    ],
    [
      '079210123456', // Only CCCD
      {
        cccd: '079210123456'
      }
    ]
  ])('Parses payload correctly: %s', (payload, expected) => {
    const result = parseCccdQr(payload);
    expect(result).toEqual(expect.objectContaining(expected));
  });
});
