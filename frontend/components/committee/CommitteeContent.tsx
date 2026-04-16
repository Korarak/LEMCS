const STEERING_COMMITTEE = [
  { no: "1.1",  name: "ศึกษาธิการจังหวัดเลย",                                                    role: "ประธานกรรมการ" },
  { no: "1.2",  name: "รองศึกษาธิการจังหวัดเลย",                                                 role: "รองประธานกรรมการ" },
  { no: "1.3",  name: "นายแพทย์สาธารณสุขจังหวัดเลย",                                             role: "กรรมการ" },
  { no: "1.4",  name: "ผู้อำนวยการโรงพยาบาลเลย",                                                 role: "กรรมการ" },
  { no: "1.5",  name: "ผู้อำนวยการโรงพยาบาลจิตเวชเลยราชนครินทร์",                               role: "กรรมการ" },
  { no: "1.6",  name: "ผู้อำนวยการสำนักงานเขตพื้นที่การศึกษามัธยมศึกษาเลย หนองบัวลำภู",         role: "กรรมการ" },
  { no: "1.7",  name: "ผู้อำนวยการสำนักงานเขตพื้นที่การศึกษาประถมศึกษาเลย เขต 1",               role: "กรรมการ" },
  { no: "1.8",  name: "ผู้อำนวยการสำนักงานเขตพื้นที่การศึกษาประถมศึกษาเลย เขต 2",               role: "กรรมการ" },
  { no: "1.9",  name: "ผู้อำนวยการสำนักงานเขตพื้นที่การศึกษาประถมศึกษาเลย เขต 3",               role: "กรรมการ" },
  { no: "1.10", name: "ผู้อำนวยการสำนักงานอาชีวศึกษาจังหวัดเลย",                                role: "กรรมการ" },
  { no: "1.11", name: "ผู้อำนวยการสำนักงานส่งเสริมการเรียนรู้ประจำจังหวัดเลย",                  role: "กรรมการ" },
  { no: "1.12", name: "ผู้อำนวยการกลุ่มส่งเสริมการศึกษาเอกชน ศธจ.เลย",                          role: "กรรมการ" },
  { no: "1.13", name: "ผู้อำนวยการกลุ่มพัฒนาการศึกษา ศธจ.เลย",                                  role: "กรรมการและเลขานุการ" },
  { no: "1.14", name: "นักวิชาการศึกษากลุ่มพัฒนาการศึกษา ศธจ.เลย",                              role: "กรรมการและผู้ช่วยเลขานุการ" },
];

const STEERING_DUTIES = [
  "กำหนดนโยบาย แนวทาง และกรอบการดำเนินงานป้องกันและแก้ไขปัญหาสุขภาพจิตนักเรียน นักศึกษาของสถานศึกษาในพื้นที่จังหวัดเลย",
  "อำนวยการ สนับสนุน และกำกับติดตามการดำเนินงานของคณะทำงานฝ่ายต่าง ๆ",
  "รายงานผลการดำเนินงานต่อคณะอนุกรรมการสุขภาพจิตจังหวัดเลยเป็นระยะ",
];

const WORKING_COMMITTEE = [
  { no: "2.1",  name: "สิบเอก มงคล ศรนวล",           org: "ศึกษาธิการจังหวัดเลย",                                                                     role: "หัวหน้าคณะทำงาน" },
  { no: "2.2",  name: "นางกาญจนา จันปุ่ม",            org: "รองศึกษาธิการจังหวัดเลย",                                                                  role: "รองหัวหน้าคณะทำงาน" },
  { no: "2.3",  name: "นางจุรีรัตน์ ประวาลลัญฉกร",   org: "หัวหน้ากลุ่มงานสุขภาพจิตและยาเสพติด สสจ.เลย",                                             role: "คณะทำงาน" },
  { no: "2.4",  name: "นางสาวสาวิตรี ทองกลม",         org: "พยาบาลวิชาชีพปฏิบัติการ สสจ.เลย",                                                          role: "คณะทำงาน" },
  { no: "2.5",  name: "นางสาวนิตยาภรณ์ โครตแก้ว",    org: "หัวหน้ากลุ่มงานสุขภาพจิตและยาเสพติด โรงพยาบาลเลย",                                        role: "คณะทำงาน" },
  { no: "2.6",  name: "นายภานุพงษ์ แก้วคร",           org: "พยาบาลวิชาชีพชำนาญการ รพ.จิตเวชเลยราชนครินทร์",                                           role: "คณะทำงาน" },
  { no: "2.7",  name: "นางสาวกรรณิกา อักษรทอง",      org: "นักจิตวิทยาคลินิกชำนาญการ รพ.จิตเวชเลยราชนครินทร์",                                       role: "คณะทำงาน" },
  { no: "2.8",  name: "ว่าที่ ร.ท.อำนาจ บำรุงแนว",   org: "ผอ.กลุ่มส่งเสริมการจัดการศึกษา สพม.เลย หนองบัวลำภู",                                      role: "คณะทำงาน" },
  { no: "2.9",  name: "นางจิรภา ฟองชัย",              org: "ผอ.กลุ่มส่งเสริมการจัดการศึกษา สพป.เลย เขต 1",                                            role: "คณะทำงาน" },
  { no: "2.10", name: "นางสาวสรัญญา ปานะสุทธิ",      org: "ผอ.กลุ่มส่งเสริมการจัดการศึกษา สพป.เลย เขต 2",                                            role: "คณะทำงาน" },
  { no: "2.11", name: "นายเริงฤทธิ์ คำหมู่",          org: "ผอ.กลุ่มส่งเสริมการจัดการศึกษา สพป.เลย เขต 3",                                            role: "คณะทำงาน" },
  { no: "2.12", name: "นายกฤตภาส ดวงชุมไพ",          org: "ปฏิบัติหน้าที่ ผอ.กลุ่มส่งเสริมการศึกษาทางไกล สพม.เลย หนองบัวลำภู",                      role: "คณะทำงาน" },
  { no: "2.13", name: "นายปิยนัฐ ธนะบุตร",            org: "ศึกษานิเทศก์ ปฏิบัติหน้าที่ ผอ.กลุ่มส่งเสริมการศึกษาทางไกล สพป.เลย เขต 1",              role: "คณะทำงาน" },
  { no: "2.14", name: "นางสาวเจนจิรา สิทธิยะ",       org: "นักจิตวิทยาประจำโรงเรียน สพม.เลย หนองบัวลำภู",                                            role: "คณะทำงาน" },
  { no: "2.15", name: "นางสาวปรมาภรณ์ สาระภักดี",    org: "นักจิตวิทยาโรงเรียน สพป.เลย เขต 1",                                                       role: "คณะทำงาน" },
  { no: "2.16", name: "นางสาวจุรีพร คำมา",            org: "นักจิตวิทยาประจำโรงเรียน สพป.เลย เขต 2",                                                  role: "คณะทำงาน" },
  { no: "2.17", name: "นางสาวจารุณี สมศรีแก้ว",      org: "นักจิตวิทยาประจำโรงเรียน สพป.เลย เขต 3",                                                  role: "คณะทำงาน" },
  { no: "2.18", name: "นางปรารถนา สุขทองสา",          org: "ครูชำนาญการพิเศษ สอศ.เลย",                                                                 role: "คณะทำงาน" },
  { no: "2.19", name: "นายกรรัก พร้อมจะบก",           org: "ครูชำนาญการ สอศ.เลย",                                                                      role: "คณะทำงาน" },
  { no: "2.20", name: "นางสาวสวรินทร์ จันทร์สว่าง",  org: "พนักงานราชการครู สอศ.เลย",                                                                  role: "คณะทำงาน" },
  { no: "2.21", name: "นายสุริยะ วิไลวงศ์",           org: "ครูชำนาญการ โรงเรียนบ้านเชียงกลม",                                                         role: "คณะทำงาน" },
  { no: "2.22", name: "นางสายันต์ คิดเข่ม",           org: "ศึกษานิเทศก์ชำนาญการพิเศษ สกร.เลย",                                                       role: "คณะทำงาน" },
  { no: "2.23", name: "นางสาวนัชชาพร สุวรรณสิงห์",   org: "นักวิชาการศึกษา สกร.เลย",                                                                  role: "คณะทำงาน" },
  { no: "2.24", name: "นางสิทธิดา แก้วโวหาร",         org: "นักเทคโนโลยีสารสนเทศ สกร.เลย",                                                             role: "คณะทำงาน" },
  { no: "2.25", name: "นางภคมน หิรัญมณีมาศ",          org: "ผอ.กลุ่มพัฒนาการศึกษา ศธจ.เลย",                                                           role: "คณะทำงานและเลขานุการ" },
  { no: "2.26", name: "นางสาวเพ็ญพร ธีนะกุล",         org: "นักวิชาการศึกษาปฏิบัติการ ศธจ.เลย",                                                       role: "คณะทำงานและผู้ช่วยเลขานุการ" },
  { no: "2.27", name: "นางสาวปนิดา วรรณศิริ",         org: "นักวิชาการศึกษาชำนาญการ ศธจ.เลย",                                                         role: "คณะทำงานและผู้ช่วยเลขานุการ" },
  { no: "2.28", name: "นางสาวอรวรรณ ชูไข",            org: "นักวิชาการศึกษาชำนาญการ ศธจ.เลย",                                                         role: "คณะทำงานและผู้ช่วยเลขานุการ" },
  { no: "2.29", name: "นางสาวณัฐรดา รัตนา",           org: "เจ้าพนักงานธุรการชำนาญงาน ศธจ.เลย",                                                       role: "คณะทำงานและผู้ช่วยเลขานุการ" },
];

const WORKING_DUTIES = [
  "ศึกษา วิเคราะห์ และสร้างเครื่องมือการคัดกรองสุขภาพจิตที่เหมาะสมตามช่วงวัย",
  "ปรับปรุงเครื่องมือให้สามารถใช้งานได้จริงในบริบทพื้นที่ มีประสิทธิภาพ และแปลผลได้ทันที",
  "พัฒนาระบบฐานข้อมูลที่สามารถรายงานผลแบบ Real-time ภายใต้หลักการคุ้มครองข้อมูลส่วนบุคคล",
  "ทดลองใช้และสรุปผลเพื่อเสนอคณะทำงานอำนวยการพิจารณา",
  "จัดทำคู่มือ แนวทาง และจัดอบรมการใช้เครื่องมือแก่หน่วยงาน/สถานศึกษา",
];

function RoleBadge({ role }: { role: string }) {
  if (role === "ประธานกรรมการ")
    return <span className="badge badge-primary badge-sm">{role}</span>;
  if (role.startsWith("รองประธาน") || role.startsWith("รองหัวหน้า"))
    return <span className="badge badge-secondary badge-sm">{role}</span>;
  if (role === "หัวหน้าคณะทำงาน")
    return <span className="badge badge-accent badge-sm">{role}</span>;
  if (role.includes("เลขานุการ"))
    return <span className="badge badge-info badge-sm">{role}</span>;
  return <span className="badge badge-ghost badge-sm">{role}</span>;
}

function Section({
  number, title, count, duties, children,
}: {
  number: string; title: string; count: number;
  duties: string[]; children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-base-200 bg-base-100 shadow-sm overflow-hidden">
      <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer select-none list-none bg-base-200/30 hover:bg-base-200/60 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-primary font-mono font-bold text-base shrink-0">{number}.</span>
          <span className="font-bold text-sm leading-snug">{title}</span>
          <span className="badge badge-ghost badge-sm shrink-0">{count} ท่าน</span>
        </div>
        {/* chevron — rotates when open */}
        <svg
          className="w-4 h-4 text-base-content/40 shrink-0 transition-transform duration-200 group-open:rotate-180"
          viewBox="0 0 24 24" fill="none"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
            stroke="currentColor" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>

      {/* Table */}
      <div className="overflow-x-auto">{children}</div>

      {/* Duties */}
      <div className="px-5 py-4 border-t border-base-200 bg-base-200/20">
        <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wider mb-2">หน้าที่</p>
        <ol className="space-y-1 text-sm text-base-content/65 list-decimal list-inside">
          {duties.map((d, i) => <li key={i}>{d}</li>)}
        </ol>
      </div>
    </details>
  );
}

export default function CommitteeContent() {
  return (
    <div className="space-y-4">
      {/* Preamble */}
      <div className="rounded-2xl border border-base-200 bg-base-100 p-5 text-sm leading-relaxed text-base-content/70 shadow-sm">
        <p className="mb-1 font-semibold text-base-content/80">ที่มาและความสำคัญ</p>
        จากข้อมูลของสำนักงานสาธารณสุขจังหวัดเลย ในช่วงปีพุทธศักราช ๒๕๖๘–๒๕๖๙
        จังหวัดเลยมีอัตราการฆ่าตัวตายสำเร็จสูง (เกิน ๘.๐ ต่อประชากรแสนคน)
        และกลุ่มเยาวชนอายุ ๑๕–๒๕ ปี มีความเสี่ยงต่อภาวะซึมเศร้าและความเครียดในระดับที่น่ากังวล
        จึงได้แต่งตั้งคณะทำงานเพื่อดำเนินการแก้ไขอย่างเป็นระบบและบูรณาการ
      </div>

      {/* Section 1 — collapsed by default */}
      <Section
        number="1"
        title="คณะกรรมการอำนวยการ"
        count={STEERING_COMMITTEE.length}
        duties={STEERING_DUTIES}
      >
        <table className="table table-sm w-full">
          <thead>
            <tr className="text-xs text-base-content/40">
              <th className="w-10">ที่</th>
              <th>ชื่อ / ตำแหน่ง</th>
              <th className="text-right">บทบาท</th>
            </tr>
          </thead>
          <tbody>
            {STEERING_COMMITTEE.map((m) => (
              <tr key={m.no} className="hover">
                <td className="font-mono text-xs text-base-content/40">{m.no}</td>
                <td className="font-medium text-sm">{m.name}</td>
                <td className="text-right"><RoleBadge role={m.role} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Section 2 — collapsed by default */}
      <Section
        number="2"
        title="คณะทำงานออกแบบและสร้างเครื่องมือการคัดกรองสุขภาพจิตในสถานศึกษา"
        count={WORKING_COMMITTEE.length}
        duties={WORKING_DUTIES}
      >
        <table className="table table-sm w-full">
          <thead>
            <tr className="text-xs text-base-content/40">
              <th className="w-10">ที่</th>
              <th>ชื่อ</th>
              <th>ตำแหน่ง / หน่วยงาน</th>
              <th className="text-right">บทบาท</th>
            </tr>
          </thead>
          <tbody>
            {WORKING_COMMITTEE.map((m) => (
              <tr key={m.no} className="hover">
                <td className="font-mono text-xs text-base-content/40">{m.no}</td>
                <td className="font-medium text-sm whitespace-nowrap">{m.name}</td>
                <td className="text-xs text-base-content/60">{m.org}</td>
                <td className="text-right"><RoleBadge role={m.role} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <p className="text-xs text-base-content/30 text-right pb-2">
        ประกาศ ณ วันที่ — มีนาคม พ.ศ. ๒๕๖๙
      </p>
    </div>
  );
}
