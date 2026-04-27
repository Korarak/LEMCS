"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { getAdminRole } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────
interface PreviewRow {
  student_code: string;
  full_name_raw: string;
  title: string;
  first_name: string;
  last_name: string;
  gender: string;
  birthdate_raw: string;
  education: string;
}

interface SheetInfo {
  name: string;
  total_rows: number;
  preview: PreviewRow[];
}

interface PreviewResult {
  sheets: SheetInfo[];
  total_sheets: number;
}

interface SheetResult {
  sheet: string;
  district: string;
  school: string;
  total_processed: number;
  created: number;
  updated: number;
  skipped: number;
  error_count: number;
  errors: { row: number; reason: string }[];
}

interface ImportSummary {
  total_created: number;
  total_updated: number;
  total_skipped: number;
  total_errors: number;
  sheets_imported: number;
}

interface ImportResult {
  results: SheetResult[];
  summary: ImportSummary;
}

interface School {
  id: number;
  name: string;
  school_type: string | null;
  student_count?: number;
}

// ─── Per-sheet searchable school picker ───────────────────────────
function SchoolPicker({
  options, value, onChange,
}: {
  options: School[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const selected = options.find(s => s.id === value) ?? null;

  const filtered = useMemo(() => {
    if (!search.trim()) return options.slice(0, 8);
    const q = search.trim().toLowerCase();
    return options.filter(s => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [options, search]);

  if (options.length === 0) {
    return <span className="text-xs text-error">ไม่มีโรงเรียน สกร. ในระบบ — กรุณาสร้างก่อน</span>;
  }

  if (selected && !open) {
    return (
      <div className="flex items-center gap-1.5 flex-1">
        <span className="text-success text-xs font-medium flex-1 truncate">✅ {selected.name}</span>
        <button type="button" className="btn btn-ghost btn-xs text-base-content/40 shrink-0"
          onClick={() => { onChange(null); setSearch(""); setOpen(true); }}>
          เปลี่ยน
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex-1">
      <input
        type="text"
        autoComplete="off"
        autoFocus={open}
        placeholder={`🔍 พิมพ์ชื่อโรงเรียน สกร. (${options.length} แห่ง)`}
        className={`input input-bordered input-xs w-full ${!value ? "input-warning" : "input-success"}`}
        value={search}
        onChange={e => setSearch(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 w-full bg-base-100 border border-base-200 rounded-xl shadow-lg mt-0.5 max-h-44 overflow-y-auto">
          {filtered.map(s => (
            <li key={s.id}
              className="px-3 py-1.5 hover:bg-primary/10 cursor-pointer text-xs transition-colors"
              onMouseDown={e => { e.preventDefault(); onChange(s.id); setSearch(""); setOpen(false); }}>
              {s.name}
            </li>
          ))}
          {options.filter(s => s.name.toLowerCase().includes(search.trim().toLowerCase())).length > 8 && (
            <li className="px-3 py-1 text-xs text-base-content/30 text-center border-t border-base-200">
              พิมพ์เพิ่มเพื่อกรอง
            </li>
          )}
        </ul>
      )}
      {open && search.trim() && filtered.length === 0 && (
        <div className="absolute z-30 w-full bg-base-100 border border-base-200 rounded-xl shadow-lg mt-0.5 px-3 py-2 text-xs text-base-content/50">
          ไม่พบโรงเรียนที่ตรงกับ "{search}"
        </div>
      )}
    </div>
  );
}

type Step = 1 | 2 | 3;

// ─── Fuzzy suggest ────────────────────────────────────────────────

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

function topSuggest(query: string, candidates: School[], n = 3): School[] {
  if (!query.trim()) return [];
  return candidates
    .map(s => ({ school: s, score: fuzzyScore(query, s.name) }))
    .filter(x => x.score > 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(x => x.school);
}

// ─── Step Bar ─────────────────────────────────────────────────────
function StepBar({ step }: { step: Step }) {
  const steps = [
    { n: 1, label: "อัปโหลดไฟล์" },
    { n: 2, label: "เลือก Sheet" },
    { n: 3, label: "ผลการนำเข้า" },
  ];
  return (
    <ul className="steps steps-horizontal w-full mb-8">
      {steps.map((s) => (
        <li
          key={s.n}
          className={`step ${step >= s.n ? "step-primary" : ""}`}
          data-content={step > s.n ? "✓" : String(s.n)}
        >
          <span className="text-xs font-medium">{s.label}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Sheet Card ───────────────────────────────────────────────────
function SheetCard({
  sheet, selected, onToggle, schoolOptions, schoolId, onSchoolChange, suggestions,
}: {
  sheet: SheetInfo;
  selected: boolean;
  onToggle: () => void;
  schoolOptions: School[];
  schoolId: number | null;
  onSchoolChange: (id: number | null) => void;
  suggestions: School[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`border rounded-xl transition-all ${
        selected
          ? schoolId ? "border-success bg-success/5 shadow-sm" : "border-warning bg-warning/5 shadow-sm"
          : "border-base-200 bg-base-100"
      }`}
    >
      <div className="flex items-center gap-3 p-4">
        <input
          type="checkbox"
          className="checkbox checkbox-primary checkbox-sm"
          checked={selected}
          onChange={onToggle}
        />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">
            {sheet.name}
            <span className="ml-1.5 text-xs font-normal text-base-content/50">
              ({sheet.total_rows.toLocaleString()} คน)
            </span>
          </div>
        </div>
        <span className={`badge badge-sm ${selected ? (schoolId ? "badge-success" : "badge-warning") : "badge-ghost"}`}>
          {selected ? (schoolId ? "พร้อม" : "ยังไม่ระบุ รร.") : "ไม่เลือก"}
        </span>
        {sheet.preview.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-xs gap-1"
            onClick={() => setExpanded(!expanded)}
          >
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                stroke="currentColor" d="M19 9l-7 7-7-7" />
            </svg>
            ตัวอย่าง
          </button>
        )}
      </div>

      {/* School mapping row — แสดงเฉพาะเมื่อ selected */}
      {selected && (
        <div className="px-4 pb-3 flex items-center gap-2 border-t border-base-200 pt-2.5">
          <span className="text-xs text-base-content/50 shrink-0">📌 โรงเรียนปลายทาง</span>
          <SchoolPicker options={schoolOptions} value={schoolId} onChange={onSchoolChange} />
          {selected && !schoolId && schoolOptions.length > 0 && (
            <span className="text-xs text-warning shrink-0">⚠️ จำเป็น</span>
          )}
        </div>
      )}

      {/* Suggestions — แสดงเมื่อ selected และมี top matches */}
      {selected && suggestions.length > 0 && (
        <div className="px-4 pb-3 flex items-center gap-1.5 flex-wrap border-t border-base-200/60 pt-2">
          <span className="text-xs text-base-content/40 shrink-0">💡 แนะนำ:</span>
          {suggestions.map(s => (
            <button
              key={s.id}
              type="button"
              className={`btn btn-xs ${schoolId === s.id ? "btn-success" : "btn-ghost"}`}
              onClick={() => onSchoolChange(s.id)}
            >
              {s.name}
              {schoolId === s.id && " ✓"}
            </button>
          ))}
        </div>
      )}

      {expanded && sheet.preview.length > 0 && (
        <div className="px-4 pb-4 overflow-x-auto">
          <table className="table table-xs text-xs w-full">
            <thead>
              <tr className="bg-base-200/60">
                <th>รหัสนักศึกษา</th>
                <th>คำนำหน้า</th>
                <th>ชื่อ</th>
                <th>นามสกุล</th>
                <th>เพศ</th>
                <th>วันเกิด</th>
                <th>วุฒิ</th>
              </tr>
            </thead>
            <tbody>
              {sheet.preview.map((row, i) => (
                <tr key={i}>
                  <td className="font-mono">{row.student_code}</td>
                  <td>{row.title || "-"}</td>
                  <td>{row.first_name || <span className="text-error">?</span>}</td>
                  <td>{row.last_name || "-"}</td>
                  <td>{row.gender || "-"}</td>
                  <td>{row.birthdate_raw || "-"}</td>
                  <td>{row.education || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-base-content/40 mt-1">
            แสดง {sheet.preview.length} แถวแรกจาก {sheet.total_rows.toLocaleString()} แถว
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Result Sheet Row ─────────────────────────────────────────────
function ResultSheetRow({ r }: { r: SheetResult }) {
  const [showErrors, setShowErrors] = useState(false);
  const hasErrors = r.error_count > 0;

  return (
    <div className="border border-base-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-3 bg-base-50">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{r.sheet}</div>
          <div className="text-xs text-base-content/50">
            {r.school} · ประมวลผล {r.total_processed.toLocaleString()} รายการ
          </div>
        </div>
        <div className="flex gap-3 text-xs shrink-0">
          <span className="text-success font-bold">+{r.created} ใหม่</span>
          <span className="text-info font-bold">↑{r.updated} อัปเดต</span>
          <span className="text-base-content/40">{r.skipped} ข้าม</span>
          {hasErrors && (
            <span className="text-error font-bold">{r.error_count} error</span>
          )}
        </div>
        {hasErrors && (
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setShowErrors(!showErrors)}
          >
            {showErrors ? "ซ่อน" : "ดู error"}
          </button>
        )}
      </div>
      {showErrors && hasErrors && (
        <div className="px-4 py-2 bg-error/5 border-t border-error/20 space-y-1 max-h-48 overflow-y-auto">
          {r.errors.map((e, i) => (
            <div key={i} className="text-xs text-error flex gap-2">
              <span className="font-mono shrink-0">แถว {e.row}</span>
              <span>{e.reason}</span>
            </div>
          ))}
          {r.error_count > r.errors.length && (
            <div className="text-xs text-base-content/40">
              ...และอีก {r.error_count - r.errors.length} errors (ดูได้ใน log)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────
export default function ImportSkrPage() {
  const { toast: showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep]               = useState<Step>(1);
  const [fileName, setFileName]       = useState<string>("");
  const [fileBytes, setFileBytes]     = useState<ArrayBuffer | null>(null);
  const [preview, setPreview]         = useState<PreviewResult | null>(null);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [importing, setImporting]     = useState(false);
  const [result, setResult]           = useState<ImportResult | null>(null);
  const [dragOver, setDragOver]       = useState(false);

  // Sheet → School mapping
  const [schoolMap, setSchoolMap] = useState<Record<string, number>>({});
  const [suggestionsMap, setSuggestionsMap] = useState<Record<string, School[]>>({});

  const [isSchoolAdmin, setIsSchoolAdmin] = useState(false);

  // Picker: all schools accessible to this user (no type filter)
  const [pickerSchools, setPickerSchools] = useState<School[]>([]);

  // Truncate by school (สกร. only, hidden for schooladmin)
  const [skrSchools,       setSkrSchools]       = useState<School[]>([]);
  const [truncateSearch,   setTruncateSearch]   = useState("");
  const [truncateSchoolId, setTruncateSchoolId] = useState<number | "">("");
  const [confirmTruncate,  setConfirmTruncate]  = useState(false);
  const [truncating,       setTruncating]       = useState(false);


  useEffect(() => {
    const isAdmin = getAdminRole() === "schooladmin";
    setIsSchoolAdmin(isAdmin);
    api.get("/admin/schools/stats?for_picker=true").then(r => {
      const all: School[] = r.data;
      setPickerSchools(all);
      setSkrSchools(all.filter(s => s.school_type === "สกร."));
    }).catch(() => {});
  }, []);

  const filteredTruncateSchools = useMemo(() => {
    if (!truncateSearch.trim()) return skrSchools;
    const q = truncateSearch.trim().toLowerCase();
    return skrSchools.filter(s => s.name.toLowerCase().includes(q));
  }, [skrSchools, truncateSearch]);

  const doTruncate = async () => {
    if (!truncateSchoolId) return;
    setTruncating(true);
    setConfirmTruncate(false);
    try {
      const res = await api.delete(`/admin/students/by-school/${truncateSchoolId}`);
      showToast(`ลบนักศึกษาของ "${res.data.school_name}" สำเร็จ — ${res.data.deleted_students} คน`, "success");
      setTruncateSchoolId("");
      setTruncateSearch("");
    } catch (e: any) {
      showToast(e?.response?.data?.detail || "เกิดข้อผิดพลาด", "error");
    } finally {
      setTruncating(false);
    }
  };

  // ── Step 1: Upload & Preview ─────────────────────────────────
  const handleFile = useCallback(async (f: File) => {
    if (!f.name.toLowerCase().match(/\.xlsx?$/)) {
      showToast("รองรับเฉพาะไฟล์ .xls และ .xlsx เท่านั้น", "error");
      return;
    }

    const buffer = await f.arrayBuffer();
    setFileBytes(buffer);
    setFileName(f.name);

    const blob = new Blob([buffer], { type: "application/vnd.ms-excel" });
    const form = new FormData();
    form.append("file", blob, f.name);
    try {
      const { data } = await api.post<PreviewResult>("/admin/import/skr-preview", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPreview(data);
      setSelected(new Set());
      // auto-suggest: หาโรงเรียนที่ชื่อตรงกับชื่ออำเภอในไฟล์
      const autoMap: Record<string, number> = {};
      const sugMap: Record<string, School[]> = {};
      for (const sheet of data.sheets) {
        const short = sheet.name.replace(/^อ\.|^อำเภอ\s*/, "").trim();
        const suggestions = topSuggest(short, pickerSchools, 3);
        sugMap[sheet.name] = suggestions;
        const match = pickerSchools.find(s => s.name.toLowerCase().includes(short.toLowerCase()));
        if (match) autoMap[sheet.name] = match.id;
        else if (suggestions.length > 0) autoMap[sheet.name] = suggestions[0].id;
      }
      setSchoolMap(autoMap);
      setSuggestionsMap(sugMap);
      setStep(2);
    } catch (err: any) {
      showToast(err?.response?.data?.detail || "อ่านไฟล์ไม่สำเร็จ", "error");
    }
  }, [showToast, pickerSchools]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  // ── Sheet selection helpers ──────────────────────────────────
  const toggleSheet = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const selectAll = () =>
    setSelected(new Set(preview?.sheets.map((s) => s.name) ?? []));
  const selectNone = () => setSelected(new Set());

  const totalSelected = preview?.sheets
    .filter((s) => selected.has(s.name))
    .reduce((sum, s) => sum + s.total_rows, 0) ?? 0;

  // ── Step 2 → 3: Confirm import ──────────────────────────────
  const unmappedSheets = Array.from(selected).filter(s => !schoolMap[s]);

  const handleImport = async () => {
    if (!fileBytes || selected.size === 0) return;
    if (unmappedSheets.length > 0) {
      showToast(`กรุณาเลือกโรงเรียนปลายทางให้ครบ — ยังไม่ได้ระบุ ${unmappedSheets.length} อำเภอ`, "warning");
      return;
    }
    setImporting(true);
    const blob = new Blob([fileBytes], { type: "application/vnd.ms-excel" });
    const form = new FormData();
    form.append("file", blob, fileName);
    form.append("selected_sheets", JSON.stringify(Array.from(selected)));
    const mapForSelected = Object.fromEntries(Array.from(selected).map(s => [s, schoolMap[s]]));
    form.append("school_map", JSON.stringify(mapForSelected));
    try {
      const { data } = await api.post<ImportResult>("/admin/import/skr-confirm", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
      setStep(3);
      showToast(
        `นำเข้าสำเร็จ: สร้างใหม่ ${data.summary.total_created} · อัปเดต ${data.summary.total_updated}`,
        "success"
      );
    } catch (err: any) {
      showToast(err?.response?.data?.detail || "นำเข้าไม่สำเร็จ", "error");
    } finally {
      setImporting(false);
    }
  };

  const resetAll = () => {
    setStep(1);
    setFileBytes(null);
    setFileName("");
    setPreview(null);
    setSelected(new Set());
    setResult(null);
    setSchoolMap({});
    setSuggestionsMap({});
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📗 นำเข้าข้อมูลนักศึกษา สกร.</h1>
        <p className="text-sm text-base-content/60 mt-1">
          นำเข้าจากไฟล์รายชื่อนักศึกษา สำนักงานส่งเสริมการเรียนรู้จังหวัดเลย (.xls)
        </p>
      </div>

      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body">
          <StepBar step={step} />

          {/* ════ Step 1: Upload ════ */}
          {step === 1 && (
            <div className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
                  ${dragOver ? "border-primary bg-primary/5" : "border-base-300 hover:border-primary/50 hover:bg-base-200/40"}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
              >
                <div className="text-4xl mb-3">📗</div>
                <p className="font-semibold text-base-content">
                  {dragOver ? "วางไฟล์ที่นี่" : "คลิกหรือลากไฟล์มาวาง"}
                </p>
                <p className="text-sm text-base-content/50 mt-1">
                  รองรับ .xls, .xlsx (รายงานรายชื่อนักศึกษา สกร.)
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xls,.xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </div>

              <div className="alert alert-info text-sm">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold">ข้อมูลที่นำเข้า</p>
                  <p className="text-xs mt-0.5">
                    ระบบจะนำเข้า: รหัสนักศึกษา, ชื่อ-นามสกุล, เพศ, วันเกิด, วุฒิการศึกษา
                    — ต้อง<a href="/admin/schools" className="underline font-medium">สร้างโรงเรียน สกร.</a>ก่อน แล้วค่อย import
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ════ Step 2: Select sheets ════ */}
          {step === 2 && preview && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="flex items-center gap-4 p-3 bg-base-200/50 rounded-xl text-sm flex-wrap">
                <div className="flex-1 min-w-0">
                  <span className="font-semibold">{fileName}</span>
                  <span className="text-base-content/50 ml-2">
                    {preview.total_sheets} อำเภอ · {preview.sheets.reduce((s, sh) => s + sh.total_rows, 0).toLocaleString()} นักศึกษา
                  </span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button type="button" className="btn btn-xs btn-ghost" onClick={selectAll}>
                    เลือกทั้งหมด
                  </button>
                  <button type="button" className="btn btn-xs btn-ghost" onClick={selectNone}>
                    ยกเลิกทั้งหมด
                  </button>
                </div>
              </div>

              {/* No schools warning */}
              {pickerSchools.length === 0 && (
                <div className="alert alert-error text-sm">
                  <span>⚠️</span>
                  <div>
                    <p className="font-semibold">ยังไม่มีโรงเรียนในระบบ</p>
                    <p className="text-xs mt-0.5">
                      กรุณา <a href="/admin/schools" className="underline font-medium">สร้างโรงเรียน</a> ก่อน แล้วค่อยกลับมา import
                    </p>
                  </div>
                </div>
              )}

              {/* Sheet list + per-sheet mapping */}
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {preview.sheets.map((sheet) => (
                  <SheetCard
                    key={sheet.name}
                    sheet={sheet}
                    selected={selected.has(sheet.name)}
                    onToggle={() => toggleSheet(sheet.name)}
                    schoolOptions={pickerSchools}
                    schoolId={schoolMap[sheet.name] ?? null}
                    onSchoolChange={id => setSchoolMap(prev =>
                      id ? { ...prev, [sheet.name]: id } : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== sheet.name))
                    )}
                    suggestions={suggestionsMap[sheet.name] ?? []}
                  />
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-3 pt-2 border-t border-base-200 flex-wrap">
                <div className="flex-1 text-sm text-base-content/60">
                  เลือก <strong className="text-base-content">{selected.size}</strong> จาก {preview.total_sheets} อำเภอ
                  {selected.size > 0 && (
                    <span> · ประมาณ <strong className="text-base-content">{totalSelected.toLocaleString()}</strong> นักศึกษา</span>
                  )}
                  {unmappedSheets.length > 0 && (
                    <span className="ml-2 text-warning font-medium">· ยังไม่ระบุ รร. {unmappedSheets.length} อำเภอ</span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={resetAll}
                >
                  ← เริ่มใหม่
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm gap-2"
                  disabled={selected.size === 0 || importing || unmappedSheets.length > 0 || pickerSchools.length === 0}
                  onClick={handleImport}
                >
                  {importing ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      กำลังนำเข้า...
                    </>
                  ) : (
                    <>นำเข้า {selected.size} อำเภอ</>
                  )}
                </button>
              </div>

              {importing && (
                <div className="alert alert-warning text-sm">
                  <svg className="w-4 h-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  กำลังนำเข้าข้อมูล {totalSelected.toLocaleString()} รายการ — กรุณาอย่าปิดหน้าต่างนี้
                </div>
              )}
            </div>
          )}

          {/* ════ Step 3: Results ════ */}
          {step === 3 && result && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "สร้างใหม่",  value: result.summary.total_created,  cls: "text-success" },
                  { label: "อัปเดต",     value: result.summary.total_updated,  cls: "text-info" },
                  { label: "ข้าม",       value: result.summary.total_skipped,  cls: "text-base-content/50" },
                  { label: "มีปัญหา",    value: result.summary.total_errors,   cls: result.summary.total_errors > 0 ? "text-error" : "text-base-content/50" },
                ].map((card) => (
                  <div key={card.label} className="stat bg-base-200/50 rounded-xl p-3">
                    <div className="stat-title text-xs">{card.label}</div>
                    <div className={`stat-value text-2xl font-bold ${card.cls}`}>
                      {card.value.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-base-content/70">ผลรายอำเภอ</h3>
                {result.results.map((r) => (
                  <ResultSheetRow key={r.sheet} r={r} />
                ))}
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-base-200">
                <button type="button" className="btn btn-ghost btn-sm" onClick={resetAll}>
                  นำเข้าใหม่
                </button>
                <a href="/admin/students" className="btn btn-primary btn-sm">
                  ดูรายชื่อนักศึกษา →
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Truncate Zone (systemadmin/superadmin only) ─────────── */}
      {!isSchoolAdmin && (
        <>
          <div className="divider text-base-content/30 text-xs">โซนอันตราย</div>
          <div className="card bg-base-100 border-2 border-error/30 shadow-sm">
            <div className="card-body p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-error text-lg">🗑️</span>
                <div>
                  <h2 className="font-bold text-error text-sm">ล้างข้อมูลนักศึกษา สกร. ทั้งอำเภอ</h2>
                  <p className="text-xs text-base-content/50">ใช้กรณี import ผิด — ลบนักศึกษาและ account ทั้งหมดของ สกร.อำเภอที่เลือก</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="🔍 พิมพ์ชื่ออำเภอ..."
                    className="input input-bordered input-sm input-error flex-1"
                    value={truncateSearch}
                    onChange={e => { setTruncateSearch(e.target.value); setTruncateSchoolId(""); }}
                  />
                  <select
                    className="select select-bordered select-sm select-error w-full sm:w-72"
                    value={truncateSchoolId}
                    onChange={e => setTruncateSchoolId(Number(e.target.value) || "")}
                  >
                    <option value="">— เลือกโรงเรียน สกร. ({filteredTruncateSchools.length} แห่ง) —</option>
                    {filteredTruncateSchools.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.student_count != null ? ` (${s.student_count.toLocaleString()} คน)` : ""}
                      </option>
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
                    <span>⚠️ จะลบนักศึกษา <strong>ทั้งหมด</strong> ของ <strong>{skrSchools.find(s => s.id === truncateSchoolId)?.name}</strong> — ไม่สามารถกู้คืนได้</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <ConfirmModal
            open={confirmTruncate}
            title="⚠️ ล้างข้อมูลนักศึกษา สกร."
            message={`ต้องการลบนักศึกษาทั้งหมดของ "${skrSchools.find(s => s.id === truncateSchoolId)?.name}" ใช่หรือไม่?`}
            detail="การกระทำนี้ไม่สามารถย้อนกลับได้ นักศึกษาและ account ทั้งหมดจะถูกลบถาวร"
            confirmLabel="ยืนยัน ล้างข้อมูล"
            confirmClass="btn-error"
            onConfirm={doTruncate}
            onCancel={() => setConfirmTruncate(false)}
          />
        </>
      )}

    </div>
  );
}
