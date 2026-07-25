/** @jest-environment node */

import sharp from "sharp";

jest.mock("@/lib/server/fileStorage", () => ({
  readPrivateFile: jest.fn(),
}));

import { readPrivateFile } from "@/lib/server/fileStorage";
import {
  generateStudentPdf,
  type PdfStudentData,
} from "@/lib/server/pdfExport";

const readPrivateFileMock = readPrivateFile as jest.MockedFunction<
  typeof readPrivateFile
>;

const data: PdfStudentData = {
  student: {
    id: "student-1",
    current_cccd: "095311003768",
    current_dob: "03/02/2010",
    status: "APPROVED",
  },
  admission_record: {
    full_name_source: "Nguyễn Ngọc Minh Anh",
    cccd_source: "095311003768",
    dob_source: "03/02/2010",
    source_tt: "1",
  },
  profile_values: [],
  files: [
    {
      category: "PHOTO_4X6",
      storage_key: "photo",
      original_name: "photo.jpg",
      mime: "image/jpeg",
      status: "ADMIN_APPROVED",
    },
    {
      category: "CCCD_FRONT",
      storage_key: "front",
      original_name: "front.jpg",
      mime: "image/jpeg",
      status: "ADMIN_APPROVED",
    },
    {
      category: "CCCD_BACK",
      storage_key: "back",
      original_name: "back.jpg",
      mime: "image/jpeg",
      status: "ADMIN_APPROVED",
    },
  ],
  family_members: [],
  policy_records: [],
  disabilities: [],
};

describe("student PDF export", () => {
  jest.setTimeout(60000);
  it("embeds a Unicode font and all three approved image records", async () => {
    const image = await sharp({
      create: {
        width: 600,
        height: 900,
        channels: 3,
        background: { r: 40, g: 80, b: 120 },
      },
    })
      .jpeg()
      .toBuffer();
    readPrivateFileMock.mockResolvedValue(image);

    const output = await generateStudentPdf(data);

    expect(output.subarray(0, 5).toString()).toBe("%PDF-");
    expect(readPrivateFileMock).toHaveBeenCalledTimes(3);
    expect(output.length).toBeGreaterThan(10_000);
  });
});
