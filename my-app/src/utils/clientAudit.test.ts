import { describe, expect, it } from "@jest/globals";
import {
  buildClientAuditMetadata,
  buildClientAuditWriteMetadata,
  buildSystemClientAuditMetadata,
} from "./clientAudit";

describe("client audit metadata", () => {
  it("records the authenticated user's stable identity and account name", () => {
    const updatedAt = new Date("2026-08-08T12:00:00Z");

    expect(
      buildClientAuditMetadata(
        { uid: "staff-1", email: "staff@example.com", displayName: "Auth Name" },
        "Staff Member",
        updatedAt
      )
    ).toEqual({
      updatedAt,
      updatedBy: {
        uid: "staff-1",
        name: "Staff Member",
        email: "staff@example.com",
      },
    });
  });

  it("labels automated client writes as system updates", () => {
    const updatedAt = new Date("2026-08-08T12:00:00Z");

    expect(buildSystemClientAuditMetadata("ETL", updatedAt)).toEqual({
      updatedAt,
      updatedBy: { uid: "ETL", name: "ETL" },
    });
  });

  it("uses a Firestore server timestamp for persisted client updates", () => {
    const metadata = buildClientAuditWriteMetadata(
      { uid: "staff-1", email: "staff@example.com" },
      "Staff Member"
    );

    expect(metadata.updatedAt).not.toBeInstanceOf(Date);
    expect(metadata.updatedBy).toEqual({
      uid: "staff-1",
      name: "Staff Member",
      email: "staff@example.com",
    });
  });
});
