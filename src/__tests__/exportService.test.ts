jest.mock('archiver', () => ({ ZipArchive: class {} }));
jest.mock('sharp', () => jest.fn());
jest.mock('@/lib/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/server/pdfExport', () => ({ generateStudentPdf: jest.fn() }));

import { buildErrorReport, effectiveValue, cccdZipPaths, exportCccd, isExportableStatus, photoZipPath, preflightExport, selectCurrentFiles } from '@/lib/server/exportService';

describe('export rules', () => {
  it.each(['APPROVED', 'LOCKED', 'EXPORTED'])('allows %s', (status) => expect(isExportableStatus(status)).toBe(true));
  it.each(['IMPORTED', 'DRAFT', 'SUBMITTED', 'NEED_REVISION'])('rejects %s', (status) => expect(isExportableStatus(status)).toBe(false));
  it('uses source until an ADMIN decision exists', () => {
    expect(effectiveValue([{ field_code: 'C', source_value: 'Nguồn', approved_value: 'Đề xuất', change_status: 'PROPOSED' }], 'C')).toBe('Nguồn');
    expect(effectiveValue([{ field_code: 'C', source_value: 'Nguồn', approved_value: 'Duyệt', change_status: 'ACCEPTED' }], 'C')).toBe('Duyệt');
  });
  it.each([
    [[{ field_code: 'BF', source_value: '095311003768', approved_value: '012345678901', change_status: 'ACCEPTED' }], '095311003768', '012345678901'],
    [[{ field_code: 'BF', source_value: null, approved_value: null, change_status: 'UNCHANGED' }], '095311003768', '095311003768'],
    [[], '095311003768', '095311003768'],
  ] as const)('uses the approved CCCD or current CCCD fallback', (profileValues, currentCccd, expected) => {
    expect(exportCccd(profileValues, currentCccd)).toBe(expected);
  });
  it('selects only the current file version', () => {
    const selected = selectCurrentFiles([{ category: 'PHOTO_4X6', storage_key: 'old', original_name: 'old', mime: 'image/jpeg', status: 'UPLOADED', current_version: 1 }, { category: 'PHOTO_4X6', storage_key: 'new', original_name: 'new', mime: 'image/jpeg', status: 'UPLOADED', current_version: 2 }]);
    expect(selected.get('PHOTO_4X6')?.storage_key).toBe('new');
  });
  it('uses the mandated ZIP paths and reports invalid ZIP inputs', () => {
    expect(photoZipPath('095311003768')).toBe('095311003768.jpg');
    expect(cccdZipPaths('095311003768')).toEqual({ front: '095311003768/mat_truoc.jpg', back: '095311003768/mat_sau.jpg' });
    const issues = preflightExport([{ cccd: '0', fullName: 'TT 829', files: new Map() }], 'CCCD_ZIP');
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['CCCD_ZERO', 'CCCD_FRONT_MISSING', 'CCCD_BACK_MISSING']));
  });
  it('reports duplicate valid CCCD values and missing photos before creating a ZIP', () => {
    const issues = preflightExport([
      { cccd: '095311003768', fullName: 'TT 829 A', files: new Map() },
      { cccd: '095311003768', fullName: 'TT 829 B', files: new Map([['PHOTO_4X6', { category: 'PHOTO_4X6', storage_key: 'photo', original_name: 'photo.jpg', mime: 'image/jpeg', status: 'UPLOADED', current_version: 1 }]]) },
    ], 'PHOTO_ZIP');
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['PHOTO_MISSING', 'CCCD_DUPLICATE']));
  });
  it.each([
    ['CCCD_FRONT_MISSING', new Map([['CCCD_BACK', { category: 'CCCD_BACK', storage_key: 'back', original_name: 'back.jpg', mime: 'image/jpeg', status: 'UPLOADED', current_version: 1 }]])],
    ['CCCD_BACK_MISSING', new Map([['CCCD_FRONT', { category: 'CCCD_FRONT', storage_key: 'front', original_name: 'front.jpg', mime: 'image/jpeg', status: 'UPLOADED', current_version: 1 }]])],
  ] as const)('reports %s before generating a CCCD ZIP', (expectedCode, files) => {
    const issues = preflightExport([{ cccd: '095311003768', fullName: 'TT 829', files }], 'CCCD_ZIP');
    expect(issues.map((issue) => issue.code)).toContain(expectedCode);
  });
  it('writes a UTF-8 BOM CSV error report', () => {
    const report = buildErrorReport([{ cccd: '0', fullName: 'Nguyễn Văn A', code: 'CCCD_ZERO' }]);
    expect(report.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(report.toString('utf8')).toContain('Nguyễn Văn A');
  });
});
