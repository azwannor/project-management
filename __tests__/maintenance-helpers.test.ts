import {
  computeAssetCustodyDiff,
  computeScheduleUrgency,
  computeWarrantyHealth,
} from "../src/lib/maintenance-helpers";
import { buildAssetQrUrl, generateAssetQrSvg } from "../src/lib/qr";

describe("Phase 5 Maintenance & Asset Helpers", () => {
  it("computes custody diffs only when holder, location, or division actually change", () => {
    const identical = computeAssetCustodyDiff(
      { assignedPerson: "Heri", location: "Marketing", detailedLocation: "JATENG 1", divisionName: "Sales" },
      { assignedPerson: "Heri", location: "Marketing", detailedLocation: "JATENG 1", divisionName: "Sales" }
    );
    expect(identical).toBeNull();

    const moved = computeAssetCustodyDiff(
      { assignedPerson: "Heri", location: "Marketing", detailedLocation: "JATENG 1", divisionName: "Sales" },
      { assignedPerson: "Dwi", location: "HO Jakarta", detailedLocation: "IT Room", divisionName: "IT" }
    );
    expect(moved).toEqual({
      previousPerson: "Heri",
      newPerson: "Dwi",
      previousLocation: "Marketing · JATENG 1",
      newLocation: "HO Jakarta · IT Room",
      previousDivision: "Sales",
      newDivision: "IT",
    });
  });

  it("evaluates warranty health accurately for untracked, active, expiring soon, and expired", () => {
    const now = new Date("2026-11-25T00:00:00.000Z").getTime();
    expect(computeWarrantyHealth(null, now)).toEqual({ state: "UNTRACKED", daysRemaining: null });
    expect(computeWarrantyHealth("2027-06-01T00:00:00.000Z", now).state).toBe("ACTIVE");
    expect(computeWarrantyHealth("2026-12-10T00:00:00.000Z", now)).toEqual({
      state: "EXPIRING_SOON",
      daysRemaining: 15,
    });
    expect(computeWarrantyHealth("2026-11-15T00:00:00.000Z", now)).toEqual({
      state: "EXPIRED",
      daysRemaining: -10,
    });
  });

  it("evaluates schedule urgency for DONE, OVERDUE, DUE_SOON, and UPCOMING", () => {
    const now = new Date("2026-11-25T00:00:00.000Z").getTime();
    expect(computeScheduleUrgency("DONE", "2026-11-20T00:00:00.000Z", now).state).toBe("DONE");
    expect(computeScheduleUrgency("UPCOMING", "2026-11-20T00:00:00.000Z", now).state).toBe("OVERDUE");
    expect(computeScheduleUrgency("UPCOMING", "2026-11-29T00:00:00.000Z", now).state).toBe("DUE_SOON");
    expect(computeScheduleUrgency("UPCOMING", "2026-12-20T00:00:00.000Z", now).state).toBe("UPCOMING");
  });

  it("builds canonical asset QR URLs and crisp SVG output", async () => {
    const url = buildAssetQrUrl("INV-LTP-127", "http://localhost:7070/");
    expect(url).toBe("http://localhost:7070/assets/q/INV-LTP-127");
    const svg = await generateAssetQrSvg("INV-LTP-127", "http://localhost:7070");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });
});
