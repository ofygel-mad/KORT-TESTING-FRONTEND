export function getFilenameFromContentDisposition(
  headerValue: string | null | undefined,
  fallback: string,
): string {
  if (!headerValue) {
    return fallback;
  }

  const utf8Match = headerValue.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const basicMatch = headerValue.match(/filename\s*=\s*"?(?<name>[^";]+)"?/i);
  return basicMatch?.groups?.name ?? fallback;
}

export function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
