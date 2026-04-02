"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";

type ImportType = "students" | "schools";

interface PreviewData { total_rows: number; preview: Record<string, string>[]; columns: string[]; }
interface ImportResult { created: number; updated: number; errors: { row: number; reason: string }[]; }

export default function ImportPage() {
  const [importType, setImportType] = useState<ImportType>("students");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<"idle"|"preview"|"done">("idle");

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setResult(null);
    setPreview(null);
    setStage("idle");

    const form = new FormData();
    form.append("file", f);
    setLoading(true);
    try {
      const res = await api.post("/admin/import/preview", form, { headers: { "Content-Type": "multipart/form-data" } });
      setPreview(res.data);
      setStage("preview");
    } catch (e: any) { alert(e?.response?.data?.detail || "ไม่สามารถอ่านไฟล์ได้"); }
    finally { setLoading(false); }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleImport = async () => {
    if (!file) return;
    if (!confirm(`ยืนยันนำเข้า ${preview?.total_rows} แถว?`)) return;
    const form = new FormData();
    form.append("file", file);
    setLoading(true);
    try {
      const res = await api.post(`/admin/import/${importType}`, form, { headers: { "Content-Type": "multipart/form-data" } });
      setResult(res.data);
      setStage("done");
    } catch (e: any) { alert(e?.response?.data?.detail || "เกิดข้อผิดพลาดระหว่าง import"); }
    finally { setLoading(false); }
  };

  const downloadTemplate = async () => {
    try {
      const res = await api.get(`/admin/import/template/${importType}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `template_${importType}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("ไม่สามารถดาวน์โหลด template ได้");
    }
  };

  const reset = () => { setFile(null); setPreview(null); setResult(null); setStage("idle"); };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">📥 นำเข้าข้อมูล</h1>
        <p className="text-base-content/60 text-sm">อัปโหลดไฟล์ CSV หรือ Excel เพื่อเพิ่ม/อัปเดตข้อมูลจำนวนมาก</p>
      </div>

      {/* Type Selector */}
      <div className="flex gap-3">
        {(["students","schools"] as ImportType[]).map(t => (
          <button key={t} onClick={() => { setImportType(t); reset(); }}
            className={`btn btn-sm ${importType === t ? "btn-primary" : "btn-ghost border border-base-300"}`}>
            {t === "students" ? "👥 นักเรียน" : "🏫 โรงเรียน"}
          </button>
        ))}
        <button className="btn btn-sm btn-ghost text-info ml-auto" onClick={downloadTemplate}>
          ⬇️ ดาวน์โหลด Template CSV
        </button>
      </div>

      {/* Dropzone */}
      {stage === "idle" && (
        <div
          className={`border-2 border-dashed rounded-2xl p-16 text-center transition-colors cursor-pointer
            ${dragging ? "border-primary bg-primary/10" : "border-base-300 hover:border-primary/50"}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("fileInput")?.click()}
        >
          {loading ? <span className="loading loading-spinner loading-lg text-primary"/> : (
            <>
              <div className="text-5xl mb-4">📂</div>
              <p className="text-lg font-medium">ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</p>
              <p className="text-base-content/50 text-sm mt-1">รองรับ .csv และ .xlsx (max 10MB)</p>
            </>
          )}
          <input id="fileInput" type="file" className="hidden" accept=".csv,.xlsx,.xls"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      )}

      {/* Preview */}
      {stage === "preview" && preview && (
        <div className="space-y-4">
          <div className="alert alert-info">
            <span>📊 พบข้อมูล <strong>{preview.total_rows} แถว</strong> — แสดง 5 แถวแรก:</span>
          </div>
          <div className="card bg-base-100 shadow overflow-x-auto">
            <table className="table table-xs table-zebra text-sm">
              <thead>
                <tr>{preview.columns.map(c => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {preview.preview.map((row, i) => (
                  <tr key={i}>{preview.columns.map(c => <td key={c}>{row[c] || "—"}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={reset}>← เปลี่ยนไฟล์</button>
            <button className="btn btn-primary btn-sm" onClick={handleImport} disabled={loading}>
              {loading ? <span className="loading loading-spinner loading-xs"/> : `✅ ยืนยัน Import ${preview.total_rows} แถว`}
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {stage === "done" && result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="stat bg-base-100 rounded-2xl shadow">
              <div className="stat-title">สร้างใหม่</div>
              <div className="stat-value text-success">{result.created}</div>
            </div>
            <div className="stat bg-base-100 rounded-2xl shadow">
              <div className="stat-title">อัปเดต</div>
              <div className="stat-value text-info">{result.updated}</div>
            </div>
            <div className="stat bg-base-100 rounded-2xl shadow">
              <div className="stat-title">ข้อผิดพลาด</div>
              <div className={`stat-value ${result.errors.length > 0 ? "text-error" : "text-base-content/30"}`}>{result.errors.length}</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h2 className="card-title text-error text-sm">⚠️ แถวที่มีข้อผิดพลาด</h2>
                <div className="overflow-x-auto">
                  <table className="table table-xs">
                    <thead><tr><th>แถว</th><th>สาเหตุ</th></tr></thead>
                    <tbody>
                      {result.errors.map((e, i) => (
                        <tr key={i}><td className="font-mono">{e.row}</td><td className="text-error">{e.reason}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <button className="btn btn-ghost btn-sm" onClick={reset}>← Import ใหม่อีกครั้ง</button>
        </div>
      )}
    </div>
  );
}
