"use client";

import { useState, useEffect, useRef } from "react";
import useSWR, { mutate } from "swr";
import { api, getApiError } from "@/lib/api";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { hasRole } from "@/lib/auth";

const fetcher = (url: string) => api.get(url).then(r => r.data);

interface Student {
  id: string; student_code: string; title: string | null;
  first_name: string; last_name: string;
  gender: string; birthdate: string | null; grade: string; classroom: string;
  school_id: number; school_name: string; is_active: boolean;
  has_national_id: boolean; created_at: string | null;
}
interface StudentsResponse { total: number; items: Student[]; }
interface School { id: number; name: string; district_id: number | null; affiliation_id: number | null; school_type: string | null; }
interface District { id: number; name: string; affiliation_id: number; }
interface Affiliation { id: number; name: string; abbreviation?: string | null; }

const GENDER_ICON: Record<string, string> = { "ชาย": "👦", "หญิง": "👧" };

// ระดับชั้นตาม school_type
const ALL_GRADES = ["ป.1","ป.2","ป.3","ป.4","ป.5","ป.6","ม.1","ม.2","ม.3","ม.4","ม.5","ม.6","ปวช.1","ปวช.2","ปวช.3","ปวส.1","ปวส.2"];
const G_PRIMARY  = ["ป.1","ป.2","ป.3","ป.4","ป.5","ป.6"];
const G_LOWSEC   = ["ม.1","ม.2","ม.3"];
const G_UPSEC    = ["ม.4","ม.5","ม.6"];
const G_VOC      = ["ปวช.1","ปวช.2","ปวช.3","ปวส.1","ปวส.2"];

const GRADES_BY_TYPE: Record<string, string[]> = {
  "ประถมศึกษา": [...G_PRIMARY, ...G_LOWSEC],                   // ป.1–6 + ม.1–3
  "มัธยมศึกษา": [...G_LOWSEC, ...G_UPSEC],                     // ม.1–6
  "อาชีวศึกษา": G_VOC,                                          // ปวช.1–3 + ปวส.1–2
  "เอกชน":      [...G_PRIMARY, ...G_LOWSEC, ...G_UPSEC, ...G_VOC], // ทุกระดับ
  "สกร.":       [...G_PRIMARY, ...G_LOWSEC, ...G_UPSEC],        // กรมส่งเสริมการเรียนรู้
};

function gradesForSchool(schoolType: string | null | undefined): string[] {
  if (!schoolType) return ALL_GRADES;
  return GRADES_BY_TYPE[schoolType] ?? ALL_GRADES;
}

function formatThaiDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const months = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
                  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  return `${d} ${months[m - 1]} ${y + 543}`;
}

const TITLES_MALE   = ["เด็กชาย", "นาย"];
const TITLES_FEMALE = ["เด็กหญิง", "นางสาว", "นาง"];
const ALL_TITLES    = [...TITLES_MALE, ...TITLES_FEMALE];

const MONTHS_TH = [
  { v: "01", l: "มกราคม" }, { v: "02", l: "กุมภาพันธ์" }, { v: "03", l: "มีนาคม" },
  { v: "04", l: "เมษายน" }, { v: "05", l: "พฤษภาคม" },  { v: "06", l: "มิถุนายน" },
  { v: "07", l: "กรกฎาคม" }, { v: "08", l: "สิงหาคม" },  { v: "09", l: "กันยายน" },
  { v: "10", l: "ตุลาคม" },  { v: "11", l: "พฤศจิกายน" }, { v: "12", l: "ธันวาคม" },
];
const DAYS_OPT = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, "0"));
const BE_NOW   = new Date().getFullYear() + 543;
const BIRTH_YEARS_BE = Array.from({ length: 35 }, (_, i) => BE_NOW - 3 - i);

const TITLE_GENDER: Record<string, string> = {
  "เด็กชาย": "ชาย", "นาย": "ชาย",
  "เด็กหญิง": "หญิง", "นางสาว": "หญิง", "นาง": "หญิง",
};

const INIT_FORM = { student_code: "", title: "นาย", first_name: "", last_name: "", gender: "ชาย", birthdate: "", grade: "ม.1", classroom: "1", school_id: "", national_id: "" };
const PAGE_SIZE = 20;

function useDebounce(value: string, delay: number) {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDeb(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return deb;
}

export default function StudentsPage() {
  const { toast } = useToast();

  // ── Static data (fetch once) ─────────────────────────────────────
  const { data: affiliations } = useSWR<Affiliation[]>("/admin/affiliations", fetcher);
  const { data: allDistricts } = useSWR<District[]>("/admin/districts", fetcher);
  const { data: allSchools }   = useSWR<School[]>("/admin/schools", fetcher);

  // ── Cascade filter state ─────────────────────────────────────────
  const [searchInput,      setSearchInput]      = useState("");
  const [filterAffil,      setFilterAffil]      = useState("");
  const [filterDistrict,   setFilterDistrict]   = useState("");
  const [filterSchool,     setFilterSchool]     = useState("");
  const [filterGrade,      setFilterGrade]      = useState("");
  const [filterClassroom,  setFilterClassroom]  = useState("");
  const [filterGender,     setFilterGender]     = useState("");
  const [filterStatus,     setFilterStatus]     = useState("");
  const [page, setPage] = useState(0);

  const search = useDebounce(searchInput, 350);

  // ── Cascade derived lists ─────────────────────────────────────────
  const visibleDistricts = filterAffil
    ? (allDistricts ?? []).filter(d => String(d.affiliation_id) === filterAffil)
    : (allDistricts ?? []);

  const visibleSchools = filterDistrict
    ? (allSchools ?? []).filter(s => String(s.district_id) === filterDistrict)
    : filterAffil
      ? (allSchools ?? []).filter(s =>
          visibleDistricts.some(d => d.id === s.district_id) ||
          String(s.affiliation_id) === filterAffil
        )
      : (allSchools ?? []);

  const selectedSchool = allSchools?.find(s => String(s.id) === filterSchool);
  const visibleGrades  = gradesForSchool(selectedSchool?.school_type);

  // ── Reset child filters when parent changes ───────────────────────
  const prevAffil    = useRef(filterAffil);
  const prevDistrict = useRef(filterDistrict);
  const prevSchool   = useRef(filterSchool);

  useEffect(() => {
    if (prevAffil.current !== filterAffil) {
      setFilterDistrict(""); setFilterSchool(""); setFilterGrade(""); setPage(0);
    }
    prevAffil.current = filterAffil;
  }, [filterAffil]);

  useEffect(() => {
    if (prevDistrict.current !== filterDistrict) {
      setFilterSchool(""); setFilterGrade(""); setPage(0);
    }
    prevDistrict.current = filterDistrict;
  }, [filterDistrict]);

  useEffect(() => {
    if (prevSchool.current !== filterSchool) {
      // keep grade only if it's still valid for the new school
      setFilterGrade(prev => visibleGrades.includes(prev) ? prev : "");
      setPage(0);
    }
    prevSchool.current = filterSchool;
  }, [filterSchool]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset page on any other filter change
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setPage(0);
  }, [search, filterGrade, filterClassroom, filterGender, filterStatus]);

  // ── Students API ─────────────────────────────────────────────────
  const params = new URLSearchParams();
  if (search)          params.set("search", search);
  if (filterSchool)    params.set("school_id", filterSchool);
  else if (filterDistrict) params.set("district_id", filterDistrict);
  else if (filterAffil)    params.set("affiliation_id", filterAffil);
  if (filterGrade)     params.set("grade", filterGrade);
  if (filterClassroom) params.set("classroom", filterClassroom);
  if (filterGender)    params.set("gender", filterGender);
  if (filterStatus !== "") params.set("is_active", filterStatus);
  params.set("limit",  String(PAGE_SIZE));
  params.set("offset", String(page * PAGE_SIZE));

  const swrKey = `/admin/students?${params}`;
  const { data, isLoading } = useSWR<StudentsResponse>(swrKey, fetcher);
  const students   = data?.items ?? [];
  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const activeFilterCount = [search, filterAffil, filterDistrict, filterSchool, filterGrade, filterClassroom, filterGender, filterStatus].filter(Boolean).length;

  const clearFilters = () => {
    setSearchInput(""); setFilterAffil(""); setFilterDistrict(""); setFilterSchool("");
    setFilterGrade(""); setFilterClassroom(""); setFilterGender(""); setFilterStatus(""); setPage(0);
  };

  // ── Modal ────────────────────────────────────────────────────────
  const [modal,        setModal]        = useState<"add"|"edit"|null>(null);
  const [editing,          setEditing]         = useState<Student | null>(null);
  const [form,             setForm]            = useState({ ...INIT_FORM });
  const [saving,           setSaving]          = useState(false);
  const [toggleTarget,     setToggleTarget]    = useState<Student | null>(null);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<Student | null>(null);
  const [hardDeleting,     setHardDeleting]    = useState(false);
  const [formNidError,    setFormNidError]    = useState("");
  const [formNidWarning,  setFormNidWarning]  = useState("");
  const [nidChecksumOk,   setNidChecksumOk]   = useState(false);

  // ── Birthdate dropdowns (พ.ศ.) ────────────────────────────────────
  const [bDay,   setBDay]   = useState("");
  const [bMonth, setBMonth] = useState("");
  const [bYear,  setBYear]  = useState("");

  const handleBirthdate = (d: string, m: string, y: string) => {
    setBDay(d); setBMonth(m); setBYear(y);
    const bd = (d && m && y) ? `${parseInt(y) - 543}-${m}-${d}` : "";
    setForm(f => ({ ...f, birthdate: bd }));
  };

  // ── National ID modal ────────────────────────────────────────────
  const [nidTarget,    setNidTarget]    = useState<Student | null>(null);
  const [nidValue,     setNidValue]     = useState("");
  const [nidConfirm,   setNidConfirm]   = useState(false);
  const [nidSaving,    setNidSaving]    = useState(false);
  const [nidError,     setNidError]     = useState("");
  const [nidWarning,   setNidWarning]   = useState("");

  const [nidClearConfirm, setNidClearConfirm] = useState(false);

  const openNid = (s: Student) => { setNidTarget(s); setNidValue(""); setNidConfirm(false); setNidClearConfirm(false); setNidError(""); setNidWarning(""); };

  function validateThaiIdFormat(id: string): string {
    const s = id.replace(/[-\s]/g, "");
    if (/^[Gg]\d{12}$/.test(s)) return "";
    if (!/^\d{13}$/.test(s)) return `ต้องเป็นตัวเลข 13 หลัก หรือ G-Code (พบ ${s.replace(/\D/g, "").length} หลัก)`;
    if (s[0] === "0") return "เลขบัตรประชาชนต้องไม่ขึ้นต้นด้วย 0";
    return "";
  }

  function validateThaiIdChecksum(id: string): string {
    const s = id.replace(/[-\s]/g, "");
    if (/^[Gg]\d{12}$/.test(s) || !/^\d{13}$/.test(s) || s[0] === "0") return "";
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += parseInt(s[i]) * (13 - i);
    const check = (11 - (sum % 11)) % 10;
    if (check !== parseInt(s[12])) return "เลข checksum ไม่ถูกต้อง — กรุณาตรวจสอบความถูกต้องของเลขอีกครั้ง";
    return "";
  }

  function validateThaiId(id: string): string {
    return validateThaiIdFormat(id) || validateThaiIdChecksum(id);
  }

  const handleNidSave = async (clear = false) => {
    if (!nidTarget) return;
    if (!clear) {
      const fmtErr = validateThaiIdFormat(nidValue);
      if (fmtErr) { setNidError(fmtErr); return; }
    }
    setNidSaving(true);
    try {
      await api.patch(`/admin/students/${nidTarget.id}/national-id`, {
        national_id: clear ? null : nidValue.replace(/[-\s]/g, ""),
      });
      setNidTarget(null); mutate(swrKey);
      toast(clear ? "ล้างเลขบัตรประชาชนสำเร็จ" : "อัปเดตเลขบัตรประชาชนสำเร็จ", "success");
    } catch (e: any) {
      setNidError(getApiError(e));
    } finally { setNidSaving(false); }
  };

  const openAdd = () => {
    setEditing(null); setForm({ ...INIT_FORM });
    setBDay(""); setBMonth(""); setBYear("");
    setFormNidError(""); setFormNidWarning(""); setNidChecksumOk(false);
    setModal("add");
  };
  const openEdit = (s: Student) => {
    setEditing(s);
    let bD = "", bM = "", bY = "";
    if (s.birthdate) {
      const [cy, cm, cd] = s.birthdate.split("-");
      bD = cd || ""; bM = cm || ""; bY = cy ? String(parseInt(cy) + 543) : "";
    }
    setBDay(bD); setBMonth(bM); setBYear(bY);
    setForm({ student_code: s.student_code, title: s.title || "นาย",
      first_name: s.first_name, last_name: s.last_name,
      gender: s.gender || "ชาย", birthdate: s.birthdate || "", grade: s.grade || "ม.1", classroom: s.classroom || "1",
      school_id: s.school_id?.toString() || "", national_id: "" });
    setModal("edit");
  };

  const handleSave = async () => {
    if (!form.student_code || !form.first_name || !form.last_name) {
      toast("กรุณากรอกข้อมูลที่จำเป็น", "warning"); return;
    }
    if (modal === "add" && form.national_id.trim()) {
      const fmtErr = validateThaiIdFormat(form.national_id);
      if (fmtErr) { setFormNidError(fmtErr); toast(`เลขบัตรประชาชน: ${fmtErr}`, "warning"); return; }
      const csumWarn = validateThaiIdChecksum(form.national_id);
      if (csumWarn && !nidChecksumOk) {
        setFormNidWarning(csumWarn);
        toast("กรุณายืนยันเลขบัตรประชาชนก่อนดำเนินการต่อ", "warning");
        return;
      }
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        ...form,
        school_id: form.school_id ? Number(form.school_id) : undefined,
        birthdate: form.birthdate || null,
      };
      if (modal === "add") {
        if (!form.national_id.trim()) delete body.national_id;
        else body.national_id = form.national_id.replace(/[-\s]/g, "");
        await api.post("/admin/students", body);
      } else if (editing) {
        const { national_id: _nid, student_code: _sc, ...editBody } = body;
        if (canEditCode && form.student_code !== editing.student_code) {
          (editBody as any).student_code = form.student_code.trim();
        }
        await api.put(`/admin/students/${editing.id}`, editBody);
      }
      setModal(null); mutate(swrKey);
      toast(modal === "add" ? "เพิ่มนักเรียนสำเร็จ" : "บันทึกข้อมูลสำเร็จ", "success");
    } catch (e: any) {
      toast(getApiError(e), "error");
    } finally { setSaving(false); }
  };

  const doToggle = async () => {
    if (!toggleTarget) return;
    try {
      await api.delete(`/admin/students/${toggleTarget.id}`);
      mutate(swrKey);
      toast(
        toggleTarget.is_active
          ? `ปิดบัญชี ${toggleTarget.first_name} ${toggleTarget.last_name} แล้ว`
          : `เปิดบัญชี ${toggleTarget.first_name} ${toggleTarget.last_name} แล้ว`,
        toggleTarget.is_active ? "warning" : "success",
      );
    } catch (e: any) {
      toast(getApiError(e), "error");
    } finally { setToggleTarget(null); }
  };

  const doHardDelete = async () => {
    if (!hardDeleteTarget) return;
    setHardDeleting(true);
    try {
      await api.delete(`/admin/students/${hardDeleteTarget.id}/hard`);
      mutate(swrKey);
      toast(`ลบ ${hardDeleteTarget.first_name} ${hardDeleteTarget.last_name} ออกจากระบบแล้ว`, "success");
    } catch (e: any) {
      toast(getApiError(e), "error");
    } finally { setHardDeleteTarget(null); setHardDeleting(false); }
  };

  const canHardDelete  = hasRole("systemadmin", "superadmin");
  const canEditCode    = hasRole("systemadmin");

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ทะเบียนนักเรียน</h1>
          <p className="text-base-content/60 text-sm">ค้นหา เพิ่ม แก้ไข จัดการสถานะบัญชี</p>
        </div>
        <div className="flex gap-2">
          <a href="/admin/import" className="btn btn-ghost btn-sm border border-base-300">📥 Import CSV</a>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>➕ เพิ่มนักเรียน</button>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="card bg-base-100 shadow">
        <div className="card-body py-3 px-4 space-y-2">

          {/* Row 1: Cascade location filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-base-content/50 font-medium w-full sm:w-auto">สถานศึกษา</span>

            {/* สังกัด */}
            <select
              className="select select-bordered select-sm"
              value={filterAffil}
              onChange={e => setFilterAffil(e.target.value)}
            >
              <option value="">ทุกสังกัด</option>
              {affiliations?.map(a => <option key={a.id} value={a.id}>{a.abbreviation ? `${a.abbreviation} — ${a.name}` : a.name}</option>)}
            </select>

            {/* เขต — แสดงเฉพาะที่ตรงกับสังกัด */}
            <select
              className="select select-bordered select-sm"
              value={filterDistrict}
              onChange={e => setFilterDistrict(e.target.value)}
              disabled={visibleDistricts.length === 0}
            >
              <option value="">ทุกเขต</option>
              {visibleDistricts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>

            {/* โรงเรียน — แสดงเฉพาะที่ตรงกับเขต/สังกัด */}
            <select
              className="select select-bordered select-sm min-w-40"
              value={filterSchool}
              onChange={e => setFilterSchool(e.target.value)}
              disabled={visibleSchools.length === 0}
            >
              <option value="">ทุกโรงเรียน</option>
              {visibleSchools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Row 2: Grade + extra filters + search */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-base-content/50 font-medium w-full sm:w-auto">กรองเพิ่มเติม</span>

            {/* ระดับชั้น — เปลี่ยนตาม school_type */}
            <select
              className="select select-bordered select-sm"
              value={filterGrade}
              onChange={e => setFilterGrade(e.target.value)}
            >
              <option value="">ทุกระดับชั้น</option>
              {visibleGrades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>

            {/* ห้อง */}
            <input
              type="text"
              className="input input-bordered input-sm w-20"
              placeholder="ห้อง"
              value={filterClassroom}
              onChange={e => setFilterClassroom(e.target.value)}
            />

            {/* เพศ */}
            <select
              className="select select-bordered select-sm"
              value={filterGender}
              onChange={e => setFilterGender(e.target.value)}
            >
              <option value="">ทุกเพศ</option>
              <option value="ชาย">👦 ชาย</option>
              <option value="หญิง">👧 หญิง</option>
            </select>

            {/* สถานะ */}
            <select
              className="select select-bordered select-sm"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="">ทุกสถานะ</option>
              <option value="true">เปิดบัญชี</option>
              <option value="false">ปิดบัญชี</option>
            </select>

            {/* ค้นหา */}
            <div className="relative ml-auto">
              <input
                type="search"
                className="input input-bordered input-sm w-60 pl-8"
                placeholder="ค้นหา ชื่อ / นามสกุล / รหัส"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/40 text-xs pointer-events-none">🔍</span>
            </div>

            {activeFilterCount > 0 && (
              <button className="btn btn-ghost btn-sm text-error gap-1" onClick={clearFilters}>
                ✕ ล้างทั้งหมด
                <span className="badge badge-error badge-xs">{activeFilterCount}</span>
              </button>
            )}
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-1 text-xs pt-1 border-t border-base-200">
              {filterAffil && (
                <span className="badge badge-outline gap-1">
                  {(() => { const a = affiliations?.find(a => String(a.id) === filterAffil); return a ? (a.abbreviation ? `${a.abbreviation} — ${a.name}` : a.name) : filterAffil; })()}
                  <button onClick={() => setFilterAffil("")} className="hover:text-error">✕</button>
                </span>
              )}
              {filterDistrict && (
                <span className="badge badge-outline gap-1">
                  {allDistricts?.find(d => String(d.id) === filterDistrict)?.name ?? filterDistrict}
                  <button onClick={() => setFilterDistrict("")} className="hover:text-error">✕</button>
                </span>
              )}
              {filterSchool && (
                <span className="badge badge-outline gap-1">
                  {selectedSchool?.name ?? filterSchool}
                  {selectedSchool?.school_type && (
                    <span className="opacity-50">({selectedSchool.school_type})</span>
                  )}
                  <button onClick={() => setFilterSchool("")} className="hover:text-error">✕</button>
                </span>
              )}
              {filterGrade && (
                <span className="badge badge-outline gap-1">
                  ชั้น {filterGrade}
                  <button onClick={() => setFilterGrade("")} className="hover:text-error">✕</button>
                </span>
              )}
              {filterClassroom && (
                <span className="badge badge-outline gap-1">
                  ห้อง {filterClassroom}
                  <button onClick={() => setFilterClassroom("")} className="hover:text-error">✕</button>
                </span>
              )}
              {filterGender && (
                <span className="badge badge-outline gap-1">
                  {filterGender}
                  <button onClick={() => setFilterGender("")} className="hover:text-error">✕</button>
                </span>
              )}
              {filterStatus !== "" && (
                <span className="badge badge-outline gap-1">
                  {filterStatus === "true" ? "เปิดบัญชี" : "ปิดบัญชี"}
                  <button onClick={() => setFilterStatus("")} className="hover:text-error">✕</button>
                </span>
              )}
              {search && (
                <span className="badge badge-outline gap-1">
                  ค้นหา: "{search}"
                  <button onClick={() => setSearchInput("")} className="hover:text-error">✕</button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card bg-base-100 shadow overflow-x-auto">
        <table className="table table-zebra w-full text-sm">
          <thead>
            <tr className="bg-base-200/50">
              <th>รหัส</th><th>ชื่อ - นามสกุล</th><th>เพศ</th>
              <th>ชั้น/ห้อง</th><th>วันเกิด</th><th>โรงเรียน</th><th>สถานะ</th>
              <th>สร้างเมื่อ</th>
              <th className="text-center w-24">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="text-center py-10"><span className="loading loading-spinner"/></td></tr>
            ) : !students.length ? (
              <tr>
                <td colSpan={9} className="text-center py-10 text-base-content/40">
                  {activeFilterCount > 0 ? "ไม่พบนักเรียนที่ตรงกับเงื่อนไข" : "ไม่พบข้อมูลนักเรียน"}
                </td>
              </tr>
            ) : students.map(s => (
              <tr key={s.id} className={`hover ${!s.is_active ? "opacity-50" : ""}`}>
                <td className="font-mono text-xs">{s.student_code}</td>
                <td className="font-medium">
                  {s.title && <span className="text-base-content/50 mr-1 text-xs">{s.title}</span>}
                  {s.first_name} {s.last_name}
                  {!s.has_national_id && (
                    <span className="ml-1.5 badge badge-xs badge-warning opacity-70" title="ยังไม่มีเลขบัตรประชาชน">ไม่มีบัตร</span>
                  )}
                </td>
                <td>{s.gender ? `${GENDER_ICON[s.gender] || ""} ${s.gender}` : "—"}</td>
                <td>{s.grade}/{s.classroom}</td>
                <td className="text-xs">{s.birthdate ? formatThaiDate(s.birthdate) : <span className="text-base-content/30">—</span>}</td>
                <td className="text-xs text-base-content/70">
                  <span className="truncate max-w-40 inline-block align-bottom" title={s.school_name}>{s.school_name}</span>
                </td>
                <td>
                  <span className={`badge badge-xs ${s.is_active ? "badge-success" : "badge-error"}`}>
                    {s.is_active ? "เปิด" : "ปิด"}
                  </span>
                </td>
                <td className="font-mono text-xs text-base-content/50">{s.created_at ? s.created_at.slice(0,10) : "—"}</td>
                <td>
                  <div className="flex gap-1 justify-center">
                    <button className="btn btn-ghost btn-xs" onClick={() => openEdit(s)} title="แก้ไข">✏️</button>
                    <button className="btn btn-ghost btn-xs" onClick={() => openNid(s)} title="แก้ไขเลขบัตรประชาชน">🪪</button>
                    <button className={`btn btn-ghost btn-xs ${s.is_active ? "text-error" : "text-success"}`}
                      onClick={() => setToggleTarget(s)} title={s.is_active ? "ปิดบัญชี" : "เปิดบัญชี"}>
                      {s.is_active ? "🚫" : "✅"}
                    </button>
                    {canHardDelete && (
                      <button className="btn btn-ghost btn-xs text-error opacity-40 hover:opacity-100"
                        onClick={() => setHardDeleteTarget(s)} title="ลบถาวร">
                        🗑️
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-base-200">
          <span className="text-sm text-base-content/50">
            {total > 0
              ? `แสดง ${page * PAGE_SIZE + 1}–${Math.min((page+1)*PAGE_SIZE, total)} จาก ${total.toLocaleString()} รายการ`
              : "ไม่มีข้อมูล"}
          </span>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-xs" disabled={page === 0} onClick={() => setPage(p => p-1)}>← ก่อนหน้า</button>
            <span className="text-xs text-base-content/50">{page+1} / {totalPages||1}</span>
            <button className="btn btn-ghost btn-xs" disabled={page+1 >= totalPages} onClick={() => setPage(p => p+1)}>ถัดไป →</button>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg mb-4">{modal === "add" ? "➕ เพิ่มนักเรียนใหม่" : "✏️ แก้ไขข้อมูลนักเรียน"}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">รหัสนักเรียน *</span>
                  {modal === "edit" && canEditCode && (
                    <span className="label-text-alt text-warning text-xs">แก้ไขได้ (systemadmin)</span>
                  )}
                </label>
                <input
                  className={`input input-bordered font-mono ${modal === "edit" && canEditCode && form.student_code !== editing?.student_code ? "input-warning" : ""}`}
                  value={form.student_code}
                  onChange={e => setForm({...form, student_code: e.target.value})}
                  disabled={modal === "edit" && !canEditCode}
                />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">คำนำหน้าชื่อ</span></label>
                <select
                  className="select select-bordered"
                  value={form.title}
                  onChange={e => {
                    const t = e.target.value;
                    setForm({...form, title: t, gender: TITLE_GENDER[t] || form.gender});
                  }}
                >
                  <option value="">— ไม่ระบุ —</option>
                  <optgroup label="ชาย">
                    {TITLES_MALE.map(t => <option key={t} value={t}>{t}</option>)}
                  </optgroup>
                  <optgroup label="หญิง">
                    {TITLES_FEMALE.map(t => <option key={t} value={t}>{t}</option>)}
                  </optgroup>
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">ชื่อ *</span></label>
                <input className="input input-bordered" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})}/>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">นามสกุล *</span></label>
                <input className="input input-bordered" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})}/>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">เพศ</span>
                  {form.title && TITLE_GENDER[form.title] && (
                    <span className="label-text-alt text-base-content/40">← อัตโนมัติจากคำนำหน้า</span>
                  )}
                </label>
                <select className="select select-bordered" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                  <option value="ชาย">ชาย</option>
                  <option value="หญิง">หญิง</option>
                </select>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">วันเกิด (พ.ศ.)</span>
                  <span className="label-text-alt text-base-content/40">ใช้ login</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <select
                    className="select select-bordered select-sm"
                    value={bDay}
                    onChange={e => handleBirthdate(e.target.value, bMonth, bYear)}
                  >
                    <option value="">วัน</option>
                    {DAYS_OPT.map(d => <option key={d} value={d}>{parseInt(d)}</option>)}
                  </select>
                  <select
                    className="select select-bordered select-sm"
                    value={bMonth}
                    onChange={e => handleBirthdate(bDay, e.target.value, bYear)}
                  >
                    <option value="">เดือน</option>
                    {MONTHS_TH.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                  </select>
                  <select
                    className="select select-bordered select-sm"
                    value={bYear}
                    onChange={e => handleBirthdate(bDay, bMonth, e.target.value)}
                  >
                    <option value="">พ.ศ.</option>
                    {BIRTH_YEARS_BE.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                {(bDay && bMonth && bYear) && (
                  <label className="label">
                    <span className="label-text-alt text-success">
                      {parseInt(bDay)} {MONTHS_TH.find(m => m.v === bMonth)?.l} {bYear}
                    </span>
                  </label>
                )}
              </div>
              <div className="form-control col-span-2">
                <label className="label"><span className="label-text">โรงเรียน</span></label>
                <select className="select select-bordered" value={form.school_id} onChange={e => setForm({...form, school_id: e.target.value, grade: "ม.1"})}>
                  <option value="">— เลือกโรงเรียน —</option>
                  {allSchools?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">ระดับชั้น</span></label>
                <select className="select select-bordered" value={form.grade} onChange={e => setForm({...form, grade: e.target.value})}>
                  {gradesForSchool(allSchools?.find(s => String(s.id) === form.school_id)?.school_type).map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">ห้อง</span></label>
                <input className="input input-bordered" value={form.classroom} onChange={e => setForm({...form, classroom: e.target.value})}/>
              </div>
              {modal === "add" && (
                <div className="form-control col-span-2">
                  <label className="label">
                    <span className="label-text">เลขบัตรประชาชน</span>
                    <span className="label-text-alt text-base-content/40">ไม่บังคับ</span>
                  </label>
                  <input
                    className={`input input-bordered font-mono tracking-widest ${formNidError ? "input-error" : formNidWarning ? "input-warning" : ""}`}
                    placeholder="x-xxxx-xxxxx-xx-x หรือ Gxxxxxxxxxxxx"
                    value={form.national_id}
                    maxLength={17}
                    onChange={e => {
                      setForm({...form, national_id: e.target.value});
                      setFormNidError(""); setFormNidWarning(""); setNidChecksumOk(false);
                    }}
                    onBlur={e => {
                      const v = e.target.value.trim();
                      if (!v) return;
                      const fmtErr = validateThaiIdFormat(v);
                      if (fmtErr) { setFormNidError(fmtErr); setFormNidWarning(""); return; }
                      const csumWarn = validateThaiIdChecksum(v);
                      setFormNidError(""); setFormNidWarning(csumWarn);
                    }}
                  />
                  {formNidError
                    ? <label className="label"><span className="label-text-alt text-error">{formNidError}</span></label>
                    : formNidWarning
                      ? (
                        <label className="label flex-col items-start gap-1">
                          <span className="label-text-alt text-warning">{formNidWarning}</span>
                          <label className="flex items-center gap-2 cursor-pointer mt-1">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-warning checkbox-sm"
                              checked={nidChecksumOk}
                              onChange={e => setNidChecksumOk(e.target.checked)}
                            />
                            <span className="text-sm text-base-content/70">ยืนยันว่าเลขที่กรอกถูกต้องแล้ว</span>
                          </label>
                        </label>
                      )
                      : <label className="label"><span className="label-text-alt text-base-content/40">ตัวเลข 13 หลัก หรือ G-Code สำหรับนักเรียนไร้สัญชาติ</span></label>
                  }
                </div>
              )}
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="loading loading-spinner loading-xs"/> : (modal === "add" ? "เพิ่ม" : "บันทึก")}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop"><button onClick={() => setModal(null)}>close</button></form>
        </dialog>
      )}

      <ConfirmModal
        open={!!toggleTarget}
        title={toggleTarget?.is_active ? "ปิดบัญชีนักเรียน" : "เปิดบัญชีนักเรียน"}
        message={`ต้องการ${toggleTarget?.is_active ? "ปิด" : "เปิด"}บัญชี ${toggleTarget?.first_name} ${toggleTarget?.last_name}?`}
        confirmLabel={toggleTarget?.is_active ? "ปิดบัญชี" : "เปิดบัญชี"}
        confirmClass={toggleTarget?.is_active ? "btn-error" : "btn-success"}
        onConfirm={doToggle}
        onCancel={() => setToggleTarget(null)}
      />

      {/* Hard delete modal */}
      {hardDeleteTarget && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg text-error mb-1">🗑️ ลบนักเรียนถาวร</h3>
            <p className="text-sm text-base-content/60 mb-4">
              {hardDeleteTarget.first_name} {hardDeleteTarget.last_name}
              <span className="ml-2 font-mono text-xs bg-base-200 px-1.5 py-0.5 rounded">
                {hardDeleteTarget.student_code}
              </span>
            </p>
            <div className="alert alert-error py-2 text-xs mb-4">
              <span>ลบข้อมูลทั้งหมดถาวร รวมถึงประวัติการประเมิน, แจ้งเตือน และ account — <strong>ไม่สามารถกู้คืนได้</strong></span>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setHardDeleteTarget(null)}>
                ยกเลิก
              </button>
              <button className="btn btn-error btn-sm" onClick={doHardDelete} disabled={hardDeleting}>
                {hardDeleting ? <span className="loading loading-spinner loading-xs" /> : "ยืนยัน ลบถาวร"}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setHardDeleteTarget(null)}>close</button>
          </form>
        </dialog>
      )}

      {/* National ID correction modal */}
      {nidTarget && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-1">🪪 แก้ไขเลขบัตรประชาชน</h3>
            <p className="text-sm text-base-content/60 mb-4">
              {nidTarget.first_name} {nidTarget.last_name} (รหัส {nidTarget.student_code})
            </p>

            {/* PDPA warning */}
            <div className="alert alert-warning text-xs mb-4 py-2">
              <span>⚠️</span>
              <span>ข้อมูลนี้เป็น PII ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล — การแก้ไขจะถูกบันทึก audit log ทุกครั้ง</span>
            </div>

            <div className="form-control">
              <label className="label"><span className="label-text font-medium">เลขบัตรประชาชนใหม่ *</span></label>
              <input
                className={`input input-bordered font-mono tracking-widest ${nidError ? "input-error" : ""}`}
                placeholder="x-xxxx-xxxxx-xx-x หรือ Gxxxxxxxxxxxx"
                value={nidValue}
                maxLength={17}
                onChange={e => { setNidValue(e.target.value); setNidError(""); setNidWarning(""); setNidConfirm(false); }}
              />
              {nidError && <label className="label"><span className="label-text-alt text-error">{nidError}</span></label>}
              <label className="label"><span className="label-text-alt text-base-content/50">ตัวเลข 13 หลัก หรือ G-Code (G + 12 หลัก) สำหรับนักเรียนไร้สัญชาติ</span></label>
            </div>

            {/* Clear NID confirm */}
            {nidClearConfirm ? (
              <div className="space-y-3 mt-2">
                <div className="alert alert-error py-2 text-xs">
                  <span>การล้างเลขบัตรประชาชนจะทำให้นักเรียนไม่สามารถ login ด้วยเลขบัตรได้จนกว่าจะกรอกใหม่</span>
                </div>
                <div className="modal-action">
                  <button className="btn btn-ghost btn-sm" onClick={() => setNidClearConfirm(false)}>← ยกเลิก</button>
                  <button className="btn btn-error btn-sm" onClick={() => handleNidSave(true)} disabled={nidSaving}>
                    {nidSaving ? <span className="loading loading-spinner loading-xs"/> : "ยืนยัน ล้างเลขบัตร"}
                  </button>
                </div>
              </div>
            ) : !nidConfirm ? (
              <div className="modal-action">
                <button className="btn btn-ghost" onClick={() => setNidTarget(null)}>ยกเลิก</button>
                <button className="btn btn-ghost btn-sm text-error"
                  onClick={() => setNidClearConfirm(true)}
                  title="ล้างเลขบัตรประชาชนที่ import ผิดออก">
                  ล้างเลขบัตร
                </button>
                <button className="btn btn-warning" onClick={() => {
                  const fmtErr = validateThaiIdFormat(nidValue);
                  if (fmtErr) { setNidError(fmtErr); setNidWarning(""); return; }
                  const csumWarn = validateThaiIdChecksum(nidValue);
                  setNidError(""); setNidWarning(csumWarn);
                  setNidConfirm(true);
                }}>ตรวจสอบ →</button>
              </div>
            ) : (
              <div className="space-y-3">
                {nidWarning && (
                  <div className="alert alert-warning py-2 text-sm">
                    <span>⚠️ {nidWarning} — หากแน่ใจว่าเลขถูกต้อง สามารถกดยืนยันได้</span>
                  </div>
                )}
                <div className="bg-base-200 rounded-lg px-4 py-3 text-sm">
                  <p className="font-medium mb-1">ยืนยันการเปลี่ยนแปลง</p>
                  <p className="font-mono text-base">{nidValue.replace(/[-\s]/g, "").replace(/(\d{1})(\d{4})(\d{5})(\d{2})(\d{1})/, "$1-$2-$3-$4-$5")}</p>
                </div>
                <div className="modal-action">
                  <button className="btn btn-ghost" onClick={() => setNidConfirm(false)}>← แก้ไข</button>
                  <button className="btn btn-error" onClick={() => handleNidSave(false)} disabled={nidSaving}>
                    {nidSaving ? <span className="loading loading-spinner loading-xs"/> : "ยืนยันบันทึก"}
                  </button>
                </div>
              </div>
            )}
          </div>
          <form method="dialog" className="modal-backdrop"><button onClick={() => setNidTarget(null)}>close</button></form>
        </dialog>
      )}
    </div>
  );
}
