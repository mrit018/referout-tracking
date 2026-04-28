export function exportToCsv(rows: Record<string, string>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = '﻿' + [
    headers.map(csvCell).join(','),
    ...rows.map(r => headers.map(h => csvCell(r[h])).join(',')),
  ].join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
}

export async function exportToExcel(rows: Record<string, string>[], filename: string) {
  if (rows.length === 0) return;
  const { utils, writeFile } = await import('xlsx');
  const headers = Object.keys(rows[0]);
  const aoa = [headers, ...rows.map(r => headers.map(h => r[h] ?? ''))];
  const ws = utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length * 1.5, 10) }));
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Sheet1');
  writeFile(wb, filename);
}

export async function sendToGoogleScript(
  rows: Record<string, string>[],
  url: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'appendReferOut', data: rows }),
    });
    const result = await res.json().catch(() => null);
    return {
      success: result?.success ?? true,
      message: result?.message ?? 'ส่งข้อมูลเรียบร้อยแล้ว',
    };
  } catch (err) {
    return {
      success: false,
      message: `ส่งไม่สำเร็จ: ${err instanceof Error ? err.message : 'ไม่ทราบสาเหตุ'}`,
    };
  }
}

function csvCell(val: string | undefined): string {
  if (!val) return '';
  const s = String(val);
  return s.includes(',') || s.includes('\n') || s.includes('"')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
