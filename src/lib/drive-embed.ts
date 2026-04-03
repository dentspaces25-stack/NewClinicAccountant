/**
 * Converts a Google Drive share URL to an embeddable preview URL.
 * Returns null if the URL is not a recognizable Drive link.
 *
 * Supported formats:
 *   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 *   https://drive.google.com/file/d/FILE_ID/edit
 *   https://drive.google.com/open?id=FILE_ID
 *   https://docs.google.com/presentation/d/FILE_ID/edit
 *   https://docs.google.com/document/d/FILE_ID/edit
 */
export function getDriveEmbedUrl(url: string): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname;

    if (!host.includes("google.com")) return null;

    // drive.google.com/file/d/FILE_ID/...
    const fileMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    if (fileMatch) {
      return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
    }

    // drive.google.com/open?id=FILE_ID
    const openId = parsed.searchParams.get("id");
    if (openId) {
      return `https://drive.google.com/file/d/${openId}/preview`;
    }

    // docs.google.com/presentation/d/FILE_ID/...  (Google Slides)
    // docs.google.com/document/d/FILE_ID/...      (Google Docs)
    // docs.google.com/spreadsheets/d/FILE_ID/...  (Google Sheets)
    const docsMatch = parsed.pathname.match(/\/d\/([^/]+)/);
    if (docsMatch && host.includes("docs.google.com")) {
      return `https://docs.google.com${parsed.pathname.replace(/\/[^/]+$/, "/preview")}`;
    }
  } catch {
    // invalid URL
  }

  return null;
}

export function isDriveUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("google.com");
  } catch {
    return false;
  }
}
