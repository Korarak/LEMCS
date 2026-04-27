"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";

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
  preview_raw: string[][];
  preview_mapped: Record<string, string>[];
  detected_school_name?: string;
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  total_processed: number;
  school_name: string;
  errors: { row: number; reason: string }[];
  nid_warnings: { row: number; student_code: string; name: string; reason: string }[];
}

interface School {
  id: number;
  name: string;
  district_id: number | null;
  affiliation_id: number | null;
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

// ─── Fuzzy suggest ────────────────────────────────────────────────────────────

function fuzzyScore(query: string, candidate: string): number {
  const norm = (s: string) =>
    s.toLowerCase().replace(/\s+/g, "").replace(/^โรงเรียน/, "");
  const q = norm(query);
  const c = norm(candidate);
  if (!q || !c) return 0;
  if (q === c) return 100;
  if (c.includes(q)) return Math.round(80 * q.length / c.length);
  if (q.includes(c)) return Math.round(80 * c.length / q.length);
  const bgSet = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const bq = bgSet(q);
  const bc = bgSet(c);
  let common = 0;
  bq.forEach(b => { if (bc.has(b)) common++; });
  const total = bq.size + bc.size;
  return total === 0 ? 0 : Math.round(100 * 2 * common / total);
}

function topSuggest(query: string, candidates: School[], n = 5): School[] {
  if (!query.trim()) return [];
  return candidates
    .map(s => ({ school: s, score: fuzzyScore(query, s.name) }))
    .filter(x => x.score > 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(x => x.school);
}

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
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const [nidAcknowledged, setNidAcknowledged] = useState(false);

  // Truncate state
  const [truncateSchoolId, setTruncateSchoolId] = useState<number | "">("");
  const [truncateSearch, setTruncateSearch] = useState("");
  const [confirmTruncate, setConfirmTruncate] = useState(false);
  const [truncating, setTruncating] = useState(false);

  // Step 1 → 2
  const [preview, setPreview] = useState<SmartPreviewResult | null>(null);
  
  // School filter state
  const [affiliations, setAffiliations] = useState<{id: number; name: string; abbreviation?: string | null}[]>([]);
  const [districts, setDistricts] = useState<{id: number; name: string; affiliation_id: number}[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedAffId, setSelectedAffId] = useState<number | "">("");
  const [selectedDistId, setSelectedDistId] = useState<number | "">("");
  const [schoolSearch, setSchoolSearch] = useState("");
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | "">("");

  // Editable mapping (col_index per field, -1 = ไม่ใช้)
  const [editMapping, setEditMapping] = useState<Record<string, number | null>>({});

  // Auto-school state
  const [detectedSchoolName, setDetectedSchoolName] = useState<string>("");
  const [createSchoolDistId,  setCreateSchoolDistId]  = useState<number | "">("");
  const [createSchoolAffId,   setCreateSchoolAffId]   = useState<number | "">("");
  const [createSchoolType,    setCreateSchoolType]    = useState<string>("");
  const [creatingSchool, setCreatingSchool] = useState(false);

  // Step 2 → 3
  const [result, setResult] = useState<ImportResult | null>(null);

  // Real-time preview — re-compute จาก preview_raw + editMapping ทุกครั้งที่ mapping เปลี่ยน
  const livePreview = useMemo(() => {
    if (!preview) return [];
    return preview.preview_raw.map(rawRow => {
      const get = (field: string): string => {
        const colIdx = editMapping[field];
        if (colIdx === null || colIdx === undefined || colIdx < 0) return "";
        return rawRow[colIdx] ?? "";  // ใช้ index โดยตรง — ไม่มีปัญหา duplicate header
      };
      const nid = get("national_id").trim();
      const isValidNid = (v: string) => {
        if (!v) return true;
        if (/^G\d{12}$/i.test(v)) return true;
        return /^\d{13}$/.test(v.replace(/[\s\-.]/g, ""));
      };
      return {
        student_code: get("student_code"),
        prefix:       get("prefix"),
        first_name:   get("first_name"),
        last_name:    get("last_name"),
        gender:       get("gender"),
        grade:        get("grade"),
        classroom:    get("classroom"),
        birthdate:    get("birthdate"),
        national_id:  nid,
        nid_valid:    isValidNid(nid),
      };
    });
  }, [preview, editMapping]);

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

  const schoolSuggestions = useMemo(
    () => !selectedSchoolId && detectedSchoolName ? topSuggest(detectedSchoolName, schools, 5) : [],
    [detectedSchoolName, selectedSchoolId, schools],
  );

  // รายชื่อโรงเรียนที่กรองตามสังกัด/เขต (ยังไม่กรองตามข้อความค้นหา)
  const filteredByAffDist = useMemo(() => {
    let list = schools;
    if (selectedDistId) {
      list = list.filter(s => s.district_id === selectedDistId);
    } else if (selectedAffId) {
      const validDistIds = new Set(districts.filter(d => d.affiliation_id === selectedAffId).map(d => d.id));
      list = list.filter(s =>
        validDistIds.has(s.district_id as number) ||
        s.affiliation_id === selectedAffId
      );
    }
    return list;
  }, [schools, districts, selectedAffId, selectedDistId]);

  // สำหรับตัวเลขแสดงใน placeholder เท่านั้น
  const filteredSchools = filteredByAffDist;

  // typeahead: ใช้ fuzzy (topSuggest) — ครอบคลุมกรณี วิทยาลัย / ชื่อ partial / spacing ต่างกัน
  const typeaheadResults = useMemo(() => {
    if (!schoolSearch.trim()) return [];
    return topSuggest(schoolSearch, filteredByAffDist, 8);
  }, [schoolSearch, filteredByAffDist]);

  // ─── Step 1: อัปโหลด ────────────────────────────────────────────────────────

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.match(/\.xlsx?$/i)) {
      toast("Smart Import รองรับเฉพาะไฟล์ .xlsx และ .xls เท่านั้น", "warning");
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

      // Auto-detect school name: ใช้ title-row detection ก่อน (วิทยาลัย/โรงเรียนใน row ก่อน header)
      // ถ้าไม่มี fallback ไปที่ column school_name ในข้อมูล
      const rawSchoolName =
        data.detected_school_name?.trim() ||
        data.preview_mapped[0]?.school_name?.trim() ||
        "";
      setDetectedSchoolName(rawSchoolName);
      if (rawSchoolName) {
        const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
        const match = schools.find(s => norm(s.name) === norm(rawSchoolName)
          || norm(s.name).includes(norm(rawSchoolName))
          || norm(rawSchoolName).includes(norm(s.name)));
        if (match) {
          setSelectedSchoolId(match.id);
          setSchoolSearch("");
          toast(`พบโรงเรียน "${match.name}" — เลือกอัตโนมัติแล้ว`, "success");
        } else {
          setSelectedSchoolId("");
          setSchoolSearch(rawSchoolName);
        }
      }
      setStep(2);
    } catch (e: any) {
      toast(e?.response?.data?.detail || "ไม่สามารถอ่านไฟล์ได้", "error");
    } finally {
      setLoading(false);
    }
  }, [toast, schools]);

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
      toast("กรุณาเลือกโรงเรียนก่อน", "warning");
      return;
    }
    setNidAcknowledged(false);
    setConfirmImport(true);
  };

  const doImport = async () => {
    if (!file || !preview || !selectedSchoolId) return;
    setConfirmImport(false);
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      // ส่ง mapping ที่ user ยืนยันแล้ว — backend จะใช้แทน auto-detect
      form.append("col_mapping", JSON.stringify(editMapping));
      const res = await api.post(
        `/admin/import/smart-confirm?school_id=${selectedSchoolId}`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setResult(res.data);
      setStep(3);
      toast(`นำเข้าสำเร็จ — สร้างใหม่ ${res.data.created} อัปเดต ${res.data.updated}`, "success");
    } catch (e: any) {
      toast(e?.response?.data?.detail || "เกิดข้อผิดพลาดระหว่าง import", "error");
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

  // สร้างโรงเรียนใหม่จากชื่อที่ตรวจพบในไฟล์
  const doCreateSchool = async () => {
    if (!detectedSchoolName || !createSchoolDistId) return;
    setCreatingSchool(true);
    try {
      const res = await api.post("/admin/schools", {
        name: detectedSchoolName,
        district_id: createSchoolDistId,
        school_type: createSchoolType || null,
      });
      // ใช้ชื่อที่ backend normalize แล้ว (มีคำนำหน้าที่ถูกต้อง)
      const normalizedName: string = res.data.name;
      const newSchool: School = {
        id: res.data.id,
        name: normalizedName,
        district_id: createSchoolDistId as number,
        affiliation_id: res.data.affiliation_id ?? null,
        school_type: createSchoolType || null,
      };
      setSchools(prev => [...prev, newSchool]);
      setSelectedSchoolId(res.data.id);
      toast(`สร้างโรงเรียน "${normalizedName}" สำเร็จ และเลือกแล้ว`, "success");
    } catch (e: any) {
      toast(e?.response?.data?.detail || "สร้างโรงเรียนไม่สำเร็จ", "error");
    } finally {
      setCreatingSchool(false);
    }
  };

  // Truncate school
  const filteredTruncateSchools = useMemo(() => {
    if (!truncateSearch.trim()) return schools;
    const q = truncateSearch.trim().toLowerCase();
    return schools.filter(s => s.name.toLowerCase().includes(q));
  }, [schools, truncateSearch]);

  const doTruncate = async () => {
    if (!truncateSchoolId) return;
    setTruncating(true);
    setConfirmTruncate(false);
    try {
      const res = await api.delete(`/admin/students/by-school/${truncateSchoolId}`);
      toast(`ลบนักเรียนของ "${res.data.school_name}" สำเร็จ — ${res.data.deleted_students} คน`, "success");
      setTruncateSchoolId("");
      setTruncateSearch("");
    } catch (e: any) {
      toast(e?.response?.data?.detail || "เกิดข้อผิดพลาด", "error");
    } finally {
      setTruncating(false);
    }
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

          {/* NID Validation Warning — real-time จาก livePreview */}
          {(() => {
            const nidIssues = livePreview.filter(row => row.national_id && !row.nid_valid);
            if (nidIssues.length === 0) return null;
            return (
              <div className="alert alert-warning">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <div>
                  <p className="font-semibold">พบเลขบัตรประชาชนที่ไม่ครบ 13 หลักใน {nidIssues.length} แถว (จาก 5 แถวตัวอย่าง)</p>
                  <p className="text-sm mt-1">ระบบจะ <strong>ข้ามการบันทึกเลขบัตรปชช.</strong> ของแถวที่ผิดรูปแบบ — กรุณาตรวจสอบ Column Mapping ของ <code>เลขประจำตัวประชาชน</code> ด้านล่างให้ถูกต้อง</p>
                </div>
              </div>
            );
          })()}

          {/* School Selector */}
          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm">🏫 โรงเรียนที่จะ Import:</h2>
                {detectedSchoolName && (
                  <span className="text-xs text-base-content/50">
                    ตรวจพบในไฟล์: <span className="font-medium text-base-content/80">"{detectedSchoolName}"</span>
                  </span>
                )}
              </div>

              {/* Fuzzy suggestions — แสดงเมื่อตรวจพบชื่อโรงเรียนแต่ยังไม่ได้เลือก */}
              {detectedSchoolName && !selectedSchoolId && schoolSuggestions.length > 0 && (
                <div>
                  <p className="text-xs text-base-content/50 mb-1.5">
                    💡 โรงเรียนที่ใกล้เคียงในระบบ — คลิกเพื่อเลือกทันที:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {schoolSuggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="btn btn-outline btn-xs hover:btn-primary"
                        onClick={() => setSelectedSchoolId(s.id)}
                      >
                        {s.name}
                        {s.school_type && (
                          <span className="opacity-50 ml-1">({s.school_type})</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* กรณีที่ตรวจพบชื่อโรงเรียนในไฟล์ แต่ไม่พบในระบบ */}
              {detectedSchoolName && !selectedSchoolId && (() => {
                const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
                const exists = schools.some(s => norm(s.name) === norm(detectedSchoolName)
                  || norm(s.name).includes(norm(detectedSchoolName))
                  || norm(detectedSchoolName).includes(norm(s.name)));
                if (exists) return null;
                const distForCreate = districts.filter(d => !createSchoolAffId || d.affiliation_id === Number(createSchoolAffId));
                return (
                  <div className="alert alert-warning py-3">
                    <div className="w-full space-y-2">
                      <p className="font-semibold text-sm">ไม่พบ "{detectedSchoolName}" ในระบบ — สร้างโรงเรียนใหม่ได้เลย</p>
                      <div className="flex flex-wrap gap-2 items-center">
                        <select className="select select-bordered select-xs"
                          value={createSchoolAffId}
                          onChange={e => { setCreateSchoolAffId(Number(e.target.value) || ""); setCreateSchoolDistId(""); }}>
                          <option value="">— เลือกสังกัด —</option>
                          {affiliations.map(a => <option key={a.id} value={a.id}>{a.abbreviation ? `${a.abbreviation} — ${a.name}` : a.name}</option>)}
                        </select>
                        <select className="select select-bordered select-xs"
                          value={createSchoolDistId}
                          onChange={e => setCreateSchoolDistId(Number(e.target.value) || "")}
                          disabled={!createSchoolAffId && distForCreate.length > 10}>
                          <option value="">— เลือกเขตพื้นที่ —</option>
                          {distForCreate.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <select className="select select-bordered select-xs"
                          value={createSchoolType}
                          onChange={e => setCreateSchoolType(e.target.value)}>
                          <option value="">— ประเภทสถานศึกษา —</option>
                          {["ประถมศึกษา","มัธยมศึกษา","อาชีวศึกษา","เอกชน","สกร."].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <button
                          className="btn btn-warning btn-xs"
                          disabled={!createSchoolDistId || creatingSchool}
                          onClick={doCreateSchool}>
                          {creatingSchool ? <span className="loading loading-spinner loading-xs"/> : "➕ สร้างและเลือก"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Filter by affiliation / district */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select className="select select-bordered select-sm w-full"
                  value={selectedAffId}
                  onChange={(e) => { setSelectedAffId(Number(e.target.value) || ""); setSelectedDistId(""); setSelectedSchoolId(""); setSchoolSearch(""); }}>
                  <option value="">— ทุกสังกัด —</option>
                  {affiliations.map(a => <option key={a.id} value={a.id}>{a.abbreviation ? `${a.abbreviation} — ${a.name}` : a.name}</option>)}
                </select>
                <select className="select select-bordered select-sm w-full"
                  value={selectedDistId}
                  onChange={(e) => { setSelectedDistId(Number(e.target.value) || ""); setSelectedSchoolId(""); setSchoolSearch(""); }}
                  disabled={availableDistricts.length === 0}>
                  <option value="">— ทุกเขตพื้นที่ —</option>
                  {availableDistricts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              {/* Typeahead school search */}
              {!selectedSchoolId ? (
                <div className="relative">
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder={`🔍 พิมพ์ชื่อโรงเรียน... (${filteredSchools.length} แห่ง)`}
                    className="input input-bordered input-sm w-full"
                    value={schoolSearch}
                    onChange={(e) => setSchoolSearch(e.target.value)}
                  />
                  {schoolSearch.trim() && typeaheadResults.length > 0 && (
                    <ul className="absolute z-20 w-full bg-base-100 border border-base-200 rounded-xl shadow-lg mt-1 max-h-52 overflow-y-auto">
                      {typeaheadResults.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-primary/10 cursor-pointer text-sm transition-colors"
                          onMouseDown={(e) => { e.preventDefault(); setSelectedSchoolId(s.id); setSchoolSearch(""); }}
                        >
                          <span className="flex-1">{s.name}</span>
                          {s.school_type && (
                            <span className="badge badge-xs badge-ghost shrink-0">{s.school_type}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {schoolSearch.trim() && typeaheadResults.length === 0 && (
                    <div className="absolute z-20 w-full bg-base-100 border border-base-200 rounded-xl shadow-lg mt-1 px-3 py-2.5 text-sm text-base-content/50">
                      ไม่พบโรงเรียนที่ตรงกับ "{schoolSearch}"
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-success/50 bg-success/5">
                  <span className="text-success text-sm flex-1 font-medium">
                    ✅ {schools.find(s => s.id === selectedSchoolId)?.name}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-base-content/50"
                    onClick={() => { setSelectedSchoolId(""); setSchoolSearch(""); }}
                  >
                    เปลี่ยน
                  </button>
                </div>
              )}
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

          {/* Data Preview — real-time จาก livePreview */}
          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body p-4">
              <h2 className="font-semibold mb-1">
                👁️ ตัวอย่างข้อมูลหลัง Mapping (5 แถวแรก)
              </h2>
              <p className="text-xs text-base-content/40 mb-3">อัปเดตทันทีเมื่อเปลี่ยน mapping ด้านบน</p>
              <div className="overflow-x-auto">
                <table className="table table-xs table-zebra text-sm">
                  <thead>
                    <tr>
                      <th>รหัสนักเรียน</th>
                      <th>คำนำหน้า</th>
                      <th>ชื่อ</th>
                      <th>นามสกุล</th>
                      <th>เพศ</th>
                      <th>ชั้น/ห้อง</th>
                      <th>วันเกิด</th>
                      <th>เลขปชช. / G-Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {livePreview.map((row, i) => (
                      <tr key={i}>
                        <td className="font-mono text-xs">
                          {row.student_code || <span className="text-error">ว่าง!</span>}
                        </td>
                        <td className="text-xs text-base-content/60">{row.prefix || "—"}</td>
                        <td>{row.first_name || "—"}</td>
                        <td>{row.last_name || "—"}</td>
                        <td>
                          <span className={`badge badge-xs ${
                            row.gender === "ชาย" ? "badge-info"
                            : row.gender === "หญิง" ? "badge-warning"
                            : "badge-ghost"
                          }`}>
                            {row.gender || "ไม่ระบุ"}
                          </span>
                        </td>
                        <td className="text-xs">{row.classroom || row.grade || "—"}</td>
                        <td className="text-xs">{row.birthdate || "—"}</td>
                        <td className="font-mono text-xs">
                          {row.national_id ? (
                            row.nid_valid ? (
                              <span className="text-success">
                                {row.national_id.slice(0, 3)}**********
                              </span>
                            ) : (
                              <span className="text-error" title={row.national_id}>
                                ⚠️ {row.national_id.slice(0, 6)}… (ผิดรูปแบบ)
                              </span>
                            )
                          ) : "—"}
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

          {/* NID Warnings Table */}
          {result.nid_warnings?.length > 0 && (
            <div className="card bg-base-100 shadow border border-warning/40">
              <div className="card-body p-4">
                <h2 className="font-semibold text-warning text-sm">
                  ⚠️ เลขประจำตัวไม่ถูกรูปแบบ ({result.nid_warnings.length} รายการ) — ไม่ได้บันทึกเลขบัตรปชช. ของรายการเหล่านี้
                </h2>
                <p className="text-xs text-base-content/60 mt-1 mb-2">
                  นักเรียนถูก import สำเร็จ แต่ไม่มีเลขประจำตัวในระบบ — อาจ login ไม่ได้จนกว่าจะแก้ไขข้อมูล<br/>
                  <span className="text-info">หมายเหตุ: G-Code (G + 12 หลัก) เช่น G123456789012 คือรหัส DMC สำหรับนักเรียนไร้สัญชาติ — ระบบรับได้แล้ว</span>
                </p>
                <div className="overflow-x-auto max-h-48">
                  <table className="table table-xs">
                    <thead className="sticky top-0 bg-base-100">
                      <tr><th>แถวที่</th><th>รหัส</th><th>ชื่อ</th><th>สาเหตุ</th></tr>
                    </thead>
                    <tbody>
                      {result.nid_warnings.map((w, i) => (
                        <tr key={i}>
                          <td className="font-mono text-xs text-warning">{w.row}</td>
                          <td className="font-mono text-xs">{w.student_code}</td>
                          <td className="text-xs">{w.name}</td>
                          <td className="text-xs text-base-content/70">{w.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

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

      {/* ─── Truncate Zone (แสดงทุก step) ──────────────────────────────────── */}
      <div className="divider text-base-content/30 text-xs">โซนอันตราย</div>
      <div className="card bg-base-100 border-2 border-error/30 shadow-sm">
        <div className="card-body p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-error text-lg">🗑️</span>
            <div>
              <h2 className="font-bold text-error text-sm">ล้างข้อมูลนักเรียนทั้งโรงเรียน</h2>
              <p className="text-xs text-base-content/50">ใช้กรณี import ผิดทั้งโรงเรียน — ลบนักเรียนและ account ทั้งหมดของโรงเรียนที่เลือก</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="🔍 พิมพ์ชื่อโรงเรียนที่ต้องการล้างข้อมูล..."
              className="input input-bordered input-sm input-error flex-1"
              value={truncateSearch}
              onChange={e => { setTruncateSearch(e.target.value); setTruncateSchoolId(""); }}
            />
            <select
              className="select select-bordered select-sm select-error w-full sm:w-72"
              value={truncateSchoolId}
              onChange={e => setTruncateSchoolId(Number(e.target.value) || "")}
            >
              <option value="">— เลือกโรงเรียน ({filteredTruncateSchools.length} แห่ง) —</option>
              {filteredTruncateSchools.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              className="btn btn-error btn-sm whitespace-nowrap"
              disabled={!truncateSchoolId || truncating}
              onClick={() => setConfirmTruncate(true)}
            >
              {truncating ? <span className="loading loading-spinner loading-xs" /> : "🗑️ ล้างข้อมูล"}
            </button>
          </div>
          {truncateSchoolId && (
            <div className="alert alert-error py-2 text-xs">
              ⚠️ จะลบนักเรียน <strong>ทั้งหมด</strong> ของ <strong>{schools.find(s => s.id === truncateSchoolId)?.name}</strong> — ไม่สามารถกู้คืนได้
            </div>
          )}
        </div>
      </div>

      {confirmImport && (() => {
        const nidIssueCount = livePreview.filter(r => r.national_id && !r.nid_valid).length;
        const hasNidIssues = nidIssueCount > 0;
        const canConfirm = !hasNidIssues || nidAcknowledged;
        return (
          <dialog className="modal modal-open">
            <div className="modal-box max-w-md">
              <h3 className="font-bold text-lg mb-2">ยืนยันการนำเข้าข้อมูล</h3>
              <p className="text-sm text-base-content/70">
                นำเข้านักเรียนจำนวน <strong>{preview?.total_rows?.toLocaleString()}</strong> แถว เข้าระบบ?
              </p>
              <p className="text-xs text-base-content/50 mt-1">ข้อมูลที่มีอยู่แล้วจะถูกอัปเดต นักเรียนใหม่จะถูกสร้าง</p>

              {hasNidIssues && (
                <div className="alert alert-warning mt-4 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  </svg>
                  <div>
                    <p className="font-semibold">พบเลขบัตรประชาชนไม่ถูกรูปแบบ {nidIssueCount} แถว (จาก 5 ตัวอย่าง)</p>
                    <p className="text-xs mt-1">อาจเกิดจาก column mapping สลับกัน — กรุณาตรวจสอบ preview อีกครั้ง</p>
                  </div>
                </div>
              )}

              {hasNidIssues && (
                <label className="flex items-start gap-3 mt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-warning mt-0.5"
                    checked={nidAcknowledged}
                    onChange={e => setNidAcknowledged(e.target.checked)}
                  />
                  <span className="text-xs text-base-content/70">
                    ฉันตรวจสอบ column mapping แล้ว และรับทราบว่าแถวที่เลขบัตรผิดรูปแบบจะ <strong>ไม่มีเลขบัตรประชาชน</strong> ในระบบ
                  </span>
                </label>
              )}

              <div className="modal-action mt-5">
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmImport(false)}>ยกเลิก</button>
                <button
                  className={`btn btn-sm ${canConfirm ? "btn-primary" : "btn-disabled"}`}
                  disabled={!canConfirm || loading}
                  onClick={doImport}
                >
                  {loading ? <><span className="loading loading-spinner loading-xs"/>กำลัง Import...</> : "ยืนยัน Import"}
                </button>
              </div>
            </div>
            <form method="dialog" className="modal-backdrop"><button onClick={() => setConfirmImport(false)}>close</button></form>
          </dialog>
        );
      })()}

      <ConfirmModal
        open={confirmTruncate}
        title="⚠️ ล้างข้อมูลนักเรียนทั้งโรงเรียน"
        message={`ต้องการลบนักเรียนทั้งหมดของ "${schools.find(s => s.id === truncateSchoolId)?.name}" ใช่หรือไม่?`}
        detail="การกระทำนี้ไม่สามารถย้อนกลับได้ นักเรียนและ account ทั้งหมดจะถูกลบถาวร"
        confirmLabel="ยืนยัน ล้างข้อมูล"
        confirmClass="btn-error"
        onConfirm={doTruncate}
        onCancel={() => setConfirmTruncate(false)}
      />
    </div>
  );
}
