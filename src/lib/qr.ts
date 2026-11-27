import QRCode from "qrcode";

/**
 * Build the canonical field-scan URL encoded into every asset QR sticker.
 */
export function buildAssetQrUrl(assetCode: string, baseUrl?: string): string {
  const origin = (
    baseUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://projectmng.royalmedicalink.id"
  ).replace(/\/+$/, "");
  return `${origin}/assets/q/${encodeURIComponent(assetCode)}`;
}

/**
 * Generate a crisp pure-vector SVG string for an asset QR code.
 */
export async function generateAssetQrSvg(assetCode: string, baseUrl?: string): Promise<string> {
  const url = buildAssetQrUrl(assetCode, baseUrl);
  return QRCode.toString(url, {
    type: "svg",
    margin: 1,
    color: {
      dark: "#0F172A",
      light: "#FFFFFF",
    },
  });
}
