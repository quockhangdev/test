/** ISO từ API (naive hoặc có Z) → chuỗi hiển thị vi-VN cho mốc thời gian lượt làm */
export function formatAttemptDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const s = String(iso).trim();
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s);
  const d = new Date(hasTz ? s : `${s}Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}
