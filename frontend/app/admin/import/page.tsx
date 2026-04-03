"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ColInfo {
  col_index: number;
  col_name: string;
}

interface SmartPreviewResult {
  total_rows: number;
  header_row_index: number;
  sheet_name: string;
  headers: string[];
  column_mapping: Record<string, ColInfo | null>;
  preview_raw: Record<string, string>[];
  preview_mapped: Record<string, string>[];
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  total_processed: number;
  school_name: string;
  errors: { row: number; reason: string }[];
}

interface School {
  id: number;
  name: string;
  district_id: number;
  school_type: string | null;
}

// ─── Field Labels ─────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, { label: string; icon: string; required?: boolean }> = {
  student_code: { label: "รหัสนักเรียน (ใช้ Login)", icon: "🔑", required: true },
  national_id:  { label: "เลขประจำตัวประชาชน (เข้ารหัส AES)", icon: "🔒" },
  prefix:       { label: "คำนำหน้าชื่อ", icon: "👤" },
  first_name:   { label: "ชื่อ", icon: "✏️", required: true },
  last_name:    { label: "นามสกุล", icon: "✏️" },
  gender:       { label: "เพศ", icon: "⚧" },
  birthdate:    { label: "วันเกิด", icon: "🎂" },
  grade:        { label: "ชั้นเรียน", icon: "📚" },
  classroom:    { label: "ห้อง/กลุ่มเรียน", icon: "🏫" },
  school_name:  { label: "ชื่อโรงเรียน (ข้อมูลเท่านั้น)", icon: "🏢" },
  school_code:  { label: "รหัสโรงเรียน (ข้อมูลเท่านั้น)", icon: "🏢" },
  status:       { label: "สถานะนักเรียน", icon: "📋" },
};

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepBar({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "อัปโหลดไฟล์" },
    { n: 2, label: "ยืนยัน Mapping" },
    { n: 3, label: "ผลการนำเข้า" },
  ];
  return (
    <ul className="steps steps-horizontal w-full mb-8">
      {steps.map((s) => (
        <li
          key={s.n}
          className={`step ${step >= s.n ? "step-primary" : ""}`}
          data-content={step > s.n ? "✓" : s.n.toString()}
        >
          <span className="text-xs font-medium">{s.label}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SmartImportPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  // Step 1 → 2
  const [preview, setPreview] = useState<SmartPreviewResult | null>(null);
  
  // School filter state
  const [affiliations, setAffiliations] = useState<{id: number; name: string}[]>([]);
  const [districts, setDistricts] = useState<{id: number; name: string; affiliation_id: number}[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedAffId, setSelectedAffId] = useState<number | "">("");
  const [selectedDistId, setSelectedDistId] = useState<number | "">("");
  const [schoolSearch, setSchoolSearch] = useState("");
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | "">("");

  // Editable mapping (col_index per field, -1 = ไม่ใช้)
  const [editMapping, setEditMapping] = useState<Record<string, number | null>>({});

  // Step 2 → 3
  const [result, setResult] = useState<ImportResult | null>(null);

  // โหลดรายการสังกัด เขตพื้นที่ และโรงเรียน
  useEffect(() => {
    Promise.all([
      api.get("/admin/affiliations").then(r => r.data).catch(() => []),
      api.get("/admin/districts").then(r => r.data).catch(() => []),
      api.get("/admin/schools").then(r => r.data).catch(() => [])
    ]).then(([affs, dists, schs]) => {
      setAffiliations(affs);
      setDistricts(dists);
      setSchools(schs);
    });
  }, []);

  const availableDistricts = useMemo(() => {
    if (!selectedAffId) return districts;
    return districts.filter(d => d.affiliation_id === selectedAffId);
  }, [districts, selectedAffId]);

  const filteredSchools = useMemo(() => {
    let list = schools;
    if (selectedDistId) {
      list = list.filter(s => s.district_id === selectedDistId);
    } else if (selectedAffId) {
      const validDistIds = new Set(districts.filter(d => d.affiliation_id === selectedAffId).map(d => d.id));
      list = list.filter(s => validDistIds.has(s.district_id));
    }
    if (schoolSearch.trim()) {
      const q = schoolSearch.trim().toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q));
    }
    return list;
  }, [schools, districts, selectedAffId, selectedDistId, schoolSearch]);

  // ─── Step 1: อัปโหลด ────────────────────────────────────────────────────────

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.match(/\.xlsx?$/i)) {
      alert("Smart Import รองรับเฉพาะไฟล์ .xlsx และ .xls เท่านั้น");
      return;
    }
    setFile(f);
    setPreview(null);
    setResult(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await api.post("/admin/import/smart-preview", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data: SmartPreviewResult = res.data;
      setPreview(data);
      // Initialize editable mapping from detected
      const init: Record<string, number | null> = {};
      for (const [field, info] of Object.entries(data.column_mapping)) {
        init[field] = info?.col_index ?? null;
      }
      setEditMapping(init);
      setStep(2);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "ไม่สามารถอ่านไฟล์ได้");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  // ─── Step 2: Confirm ─────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (!file || !preview) return;
    if (!selectedSchoolId) {
      alert("กรุณาเลือกโรงเรียนก่อน");
      return;
    }
    if (!confirm(`ยืนยันนำเข้านักเรียนจำนวน ${preview.total_rows} แถว เข้าระบบ?`)) return;

    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post(
        `/admin/import/smart-confirm?school_id=${selectedSchoolId}`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setResult(res.data);
      setStep(3);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "เกิดข้อผิดพลาดระหว่าง import");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setEditMapping({});
    setSelectedAffId("");
    setSelectedDistId("");
    setSchoolSearch("");
    setSelectedSchoolId("");
    setStep(1);
  };

  // ─── Download Error Report ───────────────────────────────────────────────────

  const downloadErrors = () => {
    if (!result) return;
    const rows = [["แถว", "สาเหตุ"], ...result.errors.map((e) => [e.row, e.reason])];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import_errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📥 Smart Import นักเรียน</h1>
        <p className="text-base-content/60 text-sm mt-1">
          นำเข้าจาก Excel ของโรงเรียนได้เลย — ไม่ต้องปรับรูปแบบหรือใช้ template
        </p>
      </div>

      <StepBar step={step} />

      {/* ─── STEP 1: อัปโหลด ─────────────────────────────────────────────────── */}
      {step === 1 && (
        <div
          className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-200
            ${dragging
              ? "border-primary bg-primary/10 scale-[1.01]"
              : "border-base-300 hover:border-primary/60 hover:bg-base-200/50"
            }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("smartFileInput")?.click()}
        >
          <input
            id="smartFileInput"
            type="file"
            className="hidden"
            accept=".xlsx,.xls"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {loading ? (
            <div className="flex flex-col items-center gap-4">
              <span className="loading loading-spinner loading-lg text-primary" />
              <p className="text-base-content/60">กำลังวิเคราะห์ไฟล์...</p>
            </div>
          ) : (
            <>
              <div className="text-6xl mb-4 select-none">📂</div>
              <p className="text-xl font-semibold">ลากไฟล์ Excel มาวางที่นี่</p>
              <p className="text-base-content/50 text-sm mt-2">
                หรือ <span className="text-primary underline">คลิกเพื่อเลือกไฟล์</span>
              </p>
              <p className="text-base-content/40 text-xs mt-3">
                รองรับ .xlsx และ .xls (ไฟล์ Export จากระบบโรงเรียนทุกรูปแบบ)
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-6">
                {["ระบบ SGS/OBEC", "ระบบอาชีวะ", "Excel ทั่วไป"].map((t) => (
                  <span key={t} className="badge badge-outline badge-sm">{t}</span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── STEP 2: ยืนยัน Mapping ──────────────────────────────────────────── */}
      {step === 2 && preview && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="alert alert-success">
            <span>
              ✅ อ่านไฟล์สำเร็จ — พบข้อมูลนักเรียน{" "}
              <strong>{preview.total_rows.toLocaleString()} แถว</strong>
              {" "}(Sheet: {preview.sheet_name}, Header แถวที่ {preview.header_row_index + 1})
            </span>
          </div>

          {/* School Selector */}
          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body p-4 space-y-3">
              <h2 className="font-semibold text-sm">🏫 ค้นหาและเลือกโรงเรียนที่จะ Import:</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  className="select select-bordered select-sm w-full"
                  value={selectedAffId}
                  onChange={(e) => {
                    setSelectedAffId(Number(e.target.value) || "");
                    setSelectedDistId("");
                    setSelectedSchoolId("");
                  }}
                >
                  <option value="">— ทุกสังกัด —</option>
                  {affiliations.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>

                <select
                  className="select select-bordered select-sm w-full"
                  value={selectedDistId}
                  onChange={(e) => {
                    setSelectedDistId(Number(e.target.value) || "");
                    setSelectedSchoolId("");
                  }}
                  disabled={availableDistricts.length === 0}
                >
                  <option value="">— ทุกเขตพื้นที่ —</option>
                  {availableDistricts.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="🔍 พิมพ์ชื่อโรงเรียน..."
                  className="input input-bordered input-sm w-full focus:outline-primary/50"
                  value={schoolSearch}
                  onChange={(e) => {
                    setSchoolSearch(e.target.value);
                    setSelectedSchoolId("");
                  }}
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <select
                  className={`select select-bordered select-sm flex-1 ${
                    !selectedSchoolId 
                      ? "select-warning border-warning/50 bg-warning/5" 
                      : "select-success border-success/50 bg-success/5"
                  }`}
                  value={selectedSchoolId}
                  onChange={(e) => setSelectedSchoolId(Number(e.target.value) || "")}
                >
                  <option value="">— เลือกโรงเรียน ({filteredSchools.length} แห่ง) —</option>
                  {filteredSchools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.school_type ? ` (${s.school_type})` : ""}
                    </option>
                  ))}
                </select>
                {selectedSchoolId && (
                  <span className="text-success text-sm font-medium whitespace-nowrap hidden sm:inline-block">✅ เลือกแล้ว</span>
                )}
              </div>
            </div>
          </div>

          {/* Column Mapping Table */}
          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body p-4">
              <h2 className="font-semibold mb-3">🗂️ การจับคู่คอลัมน์ (ตรวจสอบก่อน Import)</h2>
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr className="bg-base-200/50">
                      <th className="w-8"></th>
                      <th>Field ในระบบ LEMCS</th>
                      <th>คอลัมน์ที่ตรวจพบในไฟล์</th>
                      <th>แก้ไข</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(FIELD_LABELS).map(([field, meta]) => {
                      const detected = preview.column_mapping[field];
                      const currentIdx = editMapping[field];
                      const isDetected = detected !== null && detected !== undefined;
                      const isRequired = meta.required;
                      const isMissing = isRequired && !isDetected;

                      return (
                        <tr
                          key={field}
                          className={
                            isMissing
                              ? "bg-error/10"
                              : isDetected
                              ? "bg-success/5"
                              : ""
                          }
                        >
                          <td>
                            {isMissing ? (
                              <span className="text-error font-bold">!</span>
                            ) : isDetected ? (
                              <span className="text-success">✓</span>
                            ) : (
                              <span className="text-base-content/30">-</span>
                            )}
                          </td>
                          <td>
                            <span className="mr-1">{meta.icon}</span>
                            <span className="font-medium text-sm">{meta.label}</span>
                            {isRequired && (
                              <span className="badge badge-error badge-xs ml-2">จำเป็น</span>
                            )}
                          </td>
                          <td>
                            {isDetected ? (
                              <code className="text-xs bg-base-200 px-2 py-1 rounded">
                                {detected!.col_name}
                              </code>
                            ) : (
                              <span className="text-base-content/40 text-xs italic">
                                ไม่พบอัตโนมัติ
                              </span>
                            )}
                          </td>
                          <td>
                            <select
                              className="select select-xs select-bordered w-44"
                              value={currentIdx ?? -1}
                              onChange={(e) =>
                                setEditMapping((prev) => ({
                                  ...prev,
                                  [field]: Number(e.target.value) >= 0 ? Number(e.target.value) : null,
                                }))
                              }
                            >
                              <option value={-1}>(ไม่ใช้)</option>
                              {preview.headers.map((h, i) => (
                                <option key={i} value={i}>
                                  {h || `คอลัมน์ ${i + 1}`}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Data Preview */}
          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body p-4">
              <h2 className="font-semibold mb-3">
                👁️ ตัวอย่างข้อมูลหลัง Mapping (5 แถวแรก)
              </h2>
              <div className="overflow-x-auto">
                <table className="table table-xs table-zebra text-sm">
                  <thead>
                    <tr>
                      <th>รหัส</th>
                      <th>ชื่อ</th>
                      <th>นามสกุล</th>
                      <th>เพศ</th>
                      <th>ชั้น/ห้อง</th>
                      <th>วันเกิด</th>
                      <th>เลขปชช.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview_mapped.map((row, i) => (
                      <tr key={i}>
                        <td className="font-mono text-xs">{row.student_code || "—"}</td>
                        <td>{row.first_name || "—"}</td>
                        <td>{row.last_name || "—"}</td>
                        <td>
                          <span
                            className={`badge badge-xs ${
                              row.gender === "ชาย"
                                ? "badge-info"
                                : row.gender === "หญิง"
                                ? "badge-warning"
                                : "badge-ghost"
                            }`}
                          >
                            {row.gender || "ไม่ระบุ"}
                          </span>
                        </td>
                        <td className="text-xs">{row.classroom || row.grade || "—"}</td>
                        <td className="text-xs">{row.birthdate || "—"}</td>
                        <td className="font-mono text-xs">
                          {row.national_id
                            ? row.national_id.slice(0, 3) + "**********"
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button className="btn btn-ghost btn-sm" onClick={handleReset}>
              ← เปลี่ยนไฟล์
            </button>
            <div className="flex-1" />
            <button
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={loading || !selectedSchoolId}
            >
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  กำลัง Import...
                </>
              ) : (
                `✅ ยืนยัน Import ${preview.total_rows.toLocaleString()} แถว`
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 3: ผลลัพธ์ ─────────────────────────────────────────────────── */}
      {step === 3 && result && (
        <div className="space-y-5">
          <div className="alert alert-success">
            <span>
              🎉 Import เสร็จสิ้น — โรงเรียน <strong>{result.school_name}</strong>
            </span>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="stat bg-base-100 rounded-2xl shadow border border-base-200">
              <div className="stat-title text-xs">ประมวลผลทั้งหมด</div>
              <div className="stat-value text-2xl">{result.total_processed.toLocaleString()}</div>
              <div className="stat-desc">แถว</div>
            </div>
            <div className="stat bg-base-100 rounded-2xl shadow border border-base-200">
              <div className="stat-title text-xs">สร้างใหม่</div>
              <div className="stat-value text-2xl text-success">{result.created.toLocaleString()}</div>
              <div className="stat-desc">นักเรียน</div>
            </div>
            <div className="stat bg-base-100 rounded-2xl shadow border border-base-200">
              <div className="stat-title text-xs">อัปเดต</div>
              <div className="stat-value text-2xl text-info">{result.updated.toLocaleString()}</div>
              <div className="stat-desc">นักเรียนเดิม</div>
            </div>
            <div className="stat bg-base-100 rounded-2xl shadow border border-base-200">
              <div className="stat-title text-xs">ข้ามไป</div>
              <div className="stat-value text-2xl text-warning">{result.skipped.toLocaleString()}</div>
              <div className="stat-desc">(ออกแล้ว/ไม่ active)</div>
            </div>
          </div>

          {/* Error Table */}
          {result.errors.length > 0 && (
            <div className="card bg-base-100 shadow border border-base-200">
              <div className="card-body p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold text-error text-sm">
                    ⚠️ แถวที่มีข้อผิดพลาด ({result.errors.length} รายการ)
                  </h2>
                  <button className="btn btn-ghost btn-xs" onClick={downloadErrors}>
                    ⬇️ Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto max-h-64">
                  <table className="table table-xs">
                    <thead className="sticky top-0 bg-base-100">
                      <tr>
                        <th>แถวที่</th>
                        <th>สาเหตุ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((e, i) => (
                        <tr key={i}>
                          <td className="font-mono text-xs text-error">{e.row}</td>
                          <td className="text-xs">{e.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button className="btn btn-ghost btn-sm" onClick={handleReset}>
              ← Import ไฟล์ใหม่
            </button>
            <a href="/admin/students" className="btn btn-primary btn-sm">
              ดูรายชื่อนักเรียน →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
