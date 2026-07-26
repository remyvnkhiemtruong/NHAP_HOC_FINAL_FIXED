/** @jest-environment node */

import { buildExportContentManifest } from "@/lib/server/exportManifest";

function studentFixture() {
  return {
    id: "student-1",
    campaign_id: "campaign-1",
    current_cccd: "079210123456",
    current_dob: "01/01/2010",
    admission_record: {
      cccd_source: "079210123456",
      full_name_source: "NGUYỄN VĂN A",
      female_mark_source: null,
      dob_source: "01/01/2010",
      ethnicity_source: "Kinh",
      residence_source: "Phường A",
      middle_school_source: "THCS A",
      middle_school_commune_source: "Phường A",
      score_fields: { total: 42 },
      note_source: null,
      source_json: { C: "NGUYỄN VĂN A" },
    },
    profile_values: [
      {
        field_code: "C",
        source_value: "NGUYỄN VĂN A",
        proposed_value: "Nguyễn Văn A",
        approved_value: "Nguyễn Văn A",
        change_status: "ACCEPTED",
      },
      {
        field_code: "BF",
        source_value: "079210123456",
        proposed_value: "079210123456",
        approved_value: null,
        change_status: "UNCHANGED",
      },
    ],
    profile_versions: [{ version_number: 2 }],
    files: [
      {
        id: "file-1",
        category: "PHOTO_4X6",
        checksum: "photo-checksum",
        current_version: 1,
        status: "ADMIN_APPROVED",
      },
    ],
  };
}

describe("export content manifest", () => {
  it("is deterministic regardless of source array order", () => {
    const first = studentFixture();
    const second = studentFixture();
    second.profile_values.reverse();
    expect(
      buildExportContentManifest("campaign-1", [first]).hash,
    ).toBe(buildExportContentManifest("campaign-1", [second]).hash);
  });

  it("changes when an effective profile value or file checksum changes", () => {
    const baseline = buildExportContentManifest("campaign-1", [
      studentFixture(),
    ]).hash;
    const profileChanged = studentFixture();
    profileChanged.profile_values[0].approved_value = "Nguyễn Văn B";
    const fileChanged = studentFixture();
    fileChanged.files[0].checksum = "different-checksum";

    expect(
      buildExportContentManifest("campaign-1", [profileChanged]).hash,
    ).not.toBe(baseline);
    expect(
      buildExportContentManifest("campaign-1", [fileChanged]).hash,
    ).not.toBe(baseline);
  });
});
