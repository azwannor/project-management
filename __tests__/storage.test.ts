import { ALLOWED_UPLOAD_MIME_BY_EXT, resolveServePolicy, sanitizeStorageKey } from "@/lib/storage";

describe("Phase 1A Storage & Upload Security Policy", () => {
  it("sanitizes keys and blocks traversal, trailing dots, and invalid characters", () => {
    expect(sanitizeStorageKey("attachments/1234-abcd.png")).toBe("attachments/1234-abcd.png");
    expect(sanitizeStorageKey("attachments//1234-abcd.png")).toBe("attachments/1234-abcd.png");
    expect(sanitizeStorageKey("../etc/passwd")).toBeNull();
    expect(sanitizeStorageKey("attachments/../../secret.txt")).toBeNull();
    expect(sanitizeStorageKey("attachments/photo.")).toBeNull();
    expect(sanitizeStorageKey("attachments/<script>.png")).toBeNull();
  });

  it("blocks SVG/HTML extensions from upload MIME allowlist", () => {
    expect(".svg" in ALLOWED_UPLOAD_MIME_BY_EXT).toBe(false);
    expect(".html" in ALLOWED_UPLOAD_MIME_BY_EXT).toBe(false);
    expect(".htm" in ALLOWED_UPLOAD_MIME_BY_EXT).toBe(false);
    expect(".js" in ALLOWED_UPLOAD_MIME_BY_EXT).toBe(false);
    expect(ALLOWED_UPLOAD_MIME_BY_EXT[".png"]).toBe("image/png");
    expect(ALLOWED_UPLOAD_MIME_BY_EXT[".pdf"]).toBe("application/pdf");
  });

  it("forces attachment disposition for non-raster/non-PDF documents and safe inline for raster/PDF", () => {
    expect(resolveServePolicy("attachments/photo.png")).toEqual({
      contentType: "image/png",
      inline: true,
    });
    expect(resolveServePolicy("attachments/report.pdf")).toEqual({
      contentType: "application/pdf",
      inline: true,
    });
    expect(resolveServePolicy("attachments/assets.xlsx")).toEqual({
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      inline: false,
    });
    expect(resolveServePolicy("attachments/rogue.svg")).toEqual({
      contentType: "application/octet-stream",
      inline: false,
    });
  });
});
