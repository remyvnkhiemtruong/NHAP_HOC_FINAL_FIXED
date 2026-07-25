const ZIP_LOCAL_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_EOCD_SIGNATURE = 0x06054b50;

export class XlsxArchiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XlsxArchiveError";
  }
}

export type XlsxArchiveSummary = {
  entries: number;
  compressedBytes: number;
  uncompressedBytes: number;
};

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minimum = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_EOCD_SIGNATURE) return offset;
  }
  return -1;
}

export function validateXlsxArchive(buffer: Buffer): XlsxArchiveSummary {
  if (buffer.length < 22 || buffer.readUInt32LE(0) !== ZIP_LOCAL_SIGNATURE) {
    throw new XlsxArchiveError("Tệp không có cấu trúc ZIP/XLSX hợp lệ.");
  }
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) throw new XlsxArchiveError("Không tìm thấy thư mục trung tâm của tệp XLSX.");
  const entries = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (entries < 1 || entries > 2_000) throw new XlsxArchiveError("Số thành phần trong tệp XLSX vượt giới hạn cho phép.");
  if (centralOffset + centralSize > buffer.length || centralOffset < 0) {
    throw new XlsxArchiveError("Cấu trúc tệp XLSX bị hỏng hoặc không đầy đủ.");
  }

  let offset = centralOffset;
  let totalCompressed = 0;
  let totalUncompressed = 0;
  const names = new Set<string>();
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== ZIP_CENTRAL_SIGNATURE) {
      throw new XlsxArchiveError("Danh mục thành phần XLSX không hợp lệ.");
    }
    const compressed = buffer.readUInt32LE(offset + 20);
    const uncompressed = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > buffer.length) throw new XlsxArchiveError("Tên thành phần XLSX bị cắt cụt.");
    const name = buffer.subarray(nameStart, nameEnd).toString("utf8").replaceAll("\\", "/");
    const lowerName = name.toLowerCase();
    if (!name || name.startsWith("/") || name.split("/").includes("..")) {
      throw new XlsxArchiveError("Tệp XLSX chứa đường dẫn thành phần không an toàn.");
    }
    if (lowerName.endsWith("vbaproject.bin") || lowerName.includes("/externallinks/")) {
      throw new XlsxArchiveError("Tệp có macro hoặc liên kết ngoài; vui lòng lưu lại thành XLSX thuần.");
    }
    if (uncompressed > 40 * 1024 * 1024) throw new XlsxArchiveError("Một thành phần XLSX sau giải nén vượt 40 MB.");
    if (compressed > 0 && uncompressed > 5 * 1024 * 1024 && uncompressed / compressed > 1_000) {
      throw new XlsxArchiveError("Tỷ lệ nén của tệp XLSX bất thường.");
    }
    totalCompressed += compressed;
    totalUncompressed += uncompressed;
    if (totalUncompressed > 120 * 1024 * 1024) throw new XlsxArchiveError("Tổng dữ liệu XLSX sau giải nén vượt 120 MB.");
    names.add(lowerName);
    offset = nameEnd + extraLength + commentLength;
  }
  if (!names.has("[content_types].xml") || !names.has("xl/workbook.xml")) {
    throw new XlsxArchiveError("Tệp ZIP không phải là sổ làm việc XLSX hợp lệ.");
  }
  return { entries, compressedBytes: totalCompressed, uncompressedBytes: totalUncompressed };
}
