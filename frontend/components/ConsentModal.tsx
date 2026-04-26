"use client";

import { useState } from "react";

export interface ConsentModalProps {
  onAccept: () => void;
  onDecline: () => void;
  readOnly?: boolean;
  onClose?: () => void;
}

type Tab = "terms" | "privacy";

const C = {
  indigo: "#4f46e5",
  purple: "#7c3aed",
  green: "#10b981",
  greenBg: "#f0fdf4",
  text: "#0f172a",
  muted: "#64748b",
  subtle: "#94a3b8",
  border: "#e2e8f0",
};

// ── Layout helpers ───────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 style={{
        fontSize: "0.83rem", fontWeight: 700, color: C.text,
        margin: "0 0 8px", paddingBottom: 6,
        borderBottom: "1.5px solid #e2e8f0",
      }}>
        {title}
      </h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, color: "#374151", fontSize: "0.8rem", lineHeight: 1.8 }}>
        {children}
      </div>
    </div>
  );
}

const tdL: React.CSSProperties = {
  padding: "5px 10px 5px 0", color: C.muted, whiteSpace: "nowrap",
  verticalAlign: "top", fontWeight: 600, width: 130,
};
const tdR: React.CSSProperties = {
  padding: "5px 0", color: C.text, verticalAlign: "top",
};
const thStyle: React.CSSProperties = {
  padding: "6px 8px", background: "#f1f5f9", fontWeight: 700,
  fontSize: "0.75rem", textAlign: "left", color: C.muted,
  border: "1px solid #e2e8f0",
};
const tdStyle: React.CSSProperties = {
  padding: "6px 8px", border: "1px solid #e2e8f0",
  fontSize: "0.77rem", color: C.text, verticalAlign: "top",
};

// ── Content sections ─────────────────────────────────────────────

function TermsContent() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ color: C.subtle, fontStyle: "italic", fontSize: "0.75rem", margin: 0 }}>
        ฉบับปรับปรุงล่าสุด: 1 มีนาคม 2569 (พ.ศ.) | เวอร์ชัน 1.0
      </p>

      <Section title="1. บทนำ">
        <p>
          ระบบ LEMCS (Loei Educational MindCare System) เป็นระบบประเมินสุขภาพจิตนักเรียนและนักศึกษา
          ในจังหวัดเลย ดำเนินงานภายใต้การกำกับของสำนักงานศึกษาธิการจังหวัดเลย ข้อตกลงการใช้บริการ
          ฉบับนี้กำหนดสิทธิ หน้าที่ และเงื่อนไขการใช้บริการระบบ การใช้บริการใด ๆ ถือว่าท่าน
          ได้อ่านและยอมรับข้อตกลงนี้แล้ว
        </p>
      </Section>

      <Section title="2. คำนิยาม">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li><b>"ระบบ"</b> หมายถึง ระบบ LEMCS และบริการที่เกี่ยวข้องทั้งหมด</li>
          <li><b>"ผู้ควบคุมข้อมูล"</b> หมายถึง สำนักงานศึกษาธิการจังหวัดเลย</li>
          <li><b>"ผู้ใช้บริการ"</b> หมายถึง นักเรียน นักศึกษา ครู และบุคลากรที่ได้รับสิทธิ์เข้าใช้</li>
          <li><b>"ข้อมูลส่วนบุคคล"</b> หมายถึง ข้อมูลที่สามารถระบุตัวตนของผู้ใช้บริการได้</li>
          <li><b>"แบบประเมิน"</b> หมายถึง เครื่องมือ ST-5, PHQ-A และ CDI ที่ใช้ในระบบ</li>
        </ul>
      </Section>

      <Section title="3. สิทธิ์การใช้บริการ">
        <p>ผู้ควบคุมข้อมูลอนุญาตให้ผู้ใช้บริการที่ลงทะเบียนโดยสถานศึกษาใช้งานระบบเพื่อ:</p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>ทำแบบประเมินสุขภาพจิตตามเกณฑ์ช่วงอายุที่กำหนด</li>
          <li>ดูผลการประเมินและคำแนะนำของตนเอง</li>
          <li>ติดตามประวัติการประเมินย้อนหลังของตนเอง</li>
        </ul>
      </Section>

      <Section title="4. หน้าที่ของผู้ใช้บริการ">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>ให้ข้อมูลที่ถูกต้อง ครบถ้วน และเป็นความจริงในการตอบแบบประเมิน</li>
          <li>รักษาข้อมูลยืนยันตัวตน (รหัสนักเรียน วันเกิด เลขบัตร) ไว้เป็นความลับ</li>
          <li>แจ้งผู้ดูแลระบบทันทีหากพบการใช้งานโดยไม่ได้รับอนุญาต</li>
          <li>ปฏิบัติตามกฎระเบียบของสถานศึกษาและกฎหมายที่เกี่ยวข้อง</li>
        </ul>
      </Section>

      <Section title="5. ข้อห้ามในการใช้บริการ">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>เข้าถึงบัญชีหรือข้อมูลของผู้อื่นโดยไม่ได้รับอนุญาต</li>
          <li>ดัดแปลง แก้ไข หรือพยายามทำลายระบบหรือข้อมูลในระบบ</li>
          <li>ใช้ระบบเพื่อวัตถุประสงค์อื่นนอกจากที่กำหนด</li>
          <li>เผยแพร่ผลการประเมินของผู้อื่นโดยไม่ได้รับความยินยอม</li>
          <li>ทดสอบหรือโจมตีช่องโหว่ด้านความปลอดภัยของระบบ</li>
        </ul>
      </Section>

      <Section title="6. ข้อจำกัดความรับผิด">
        <p>
          ผลการประเมินจากระบบ LEMCS เป็นเพียงการคัดกรองเบื้องต้นตามหลักวิทยาศาสตร์
          <b>ไม่ถือเป็นการวินิจฉัยทางการแพทย์</b> ผู้ใช้บริการที่มีความกังวลเกี่ยวกับ
          สุขภาพจิตควรปรึกษาผู้เชี่ยวชาญด้านสุขภาพจิตหรือแพทย์โดยตรง
        </p>
        <p>
          ผู้ควบคุมข้อมูลไม่รับผิดชอบต่อความเสียหายที่เกิดจากการใช้งานในทางที่ผิด
          หรือการตีความผลการประเมินอย่างไม่ถูกต้อง
        </p>
      </Section>

      <Section title="7. ทรัพย์สินทางปัญญา">
        <p>
          ระบบ LEMCS รวมถึงซอฟต์แวร์ การออกแบบ และเนื้อหาทั้งหมดเป็นทรัพย์สินของ
          สำนักงานศึกษาธิการจังหวัดเลย ผู้ใช้บริการไม่มีสิทธิ์คัดลอก ดัดแปลง
          หรือนำไปใช้เชิงพาณิชย์โดยไม่ได้รับอนุญาต
        </p>
      </Section>

      <Section title="8. การระงับหรือยกเลิกการใช้บริการ">
        <p>
          ผู้ควบคุมข้อมูลสงวนสิทธิ์ระงับหรือยกเลิกสิทธิ์การเข้าถึงของผู้ใช้บริการ
          หากพบว่ามีการฝ่าฝืนข้อตกลงนี้ โดยไม่ต้องแจ้งให้ทราบล่วงหน้า
        </p>
      </Section>

      <Section title="9. กฎหมายที่ใช้บังคับ">
        <p>
          ข้อตกลงฉบับนี้อยู่ภายใต้กฎหมายไทย ข้อพิพาทใด ๆ อยู่ในเขตอำนาจของศาลในจังหวัดเลย
        </p>
      </Section>

      <Section title="10. การแก้ไขข้อตกลง">
        <p>
          ผู้ควบคุมข้อมูลอาจแก้ไขข้อตกลงนี้เป็นครั้งคราว การแก้ไขจะมีผลทันทีเมื่อประกาศในระบบ
          การใช้บริการต่อเนื่องถือว่าท่านยอมรับข้อตกลงที่แก้ไขแล้ว
        </p>
      </Section>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ color: C.subtle, fontStyle: "italic", fontSize: "0.75rem", margin: 0 }}>
        ฉบับปรับปรุงล่าสุด: 1 มีนาคม 2569 (พ.ศ.) | เวอร์ชัน 1.0
      </p>

      <Section title="1. ผู้ควบคุมข้อมูลส่วนบุคคล">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={tdL}>ชื่อองค์กร</td>
              <td style={tdR}>สำนักงานศึกษาธิการจังหวัดเลย</td>
            </tr>
            <tr>
              <td style={tdL}>ที่อยู่</td>
              <td style={tdR}>ถนนมลิวรรณ ตำบลกุดป่อง อำเภอเมืองเลย จังหวัดเลย 42000</td>
            </tr>
            <tr>
              <td style={tdL}>โทรศัพท์</td>
              <td style={tdR}>0-4281-1527</td>
            </tr>
            <tr>
              <td style={tdL}>อีเมล</td>
              <td style={tdR}>loei@sueksa.go.th</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="2. เจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคล (DPO)">
        <p>ท่านสามารถติดต่อเจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคลของระบบ LEMCS ได้ที่:</p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={tdL}>อีเมล DPO</td>
              <td style={tdR}>dpo-lemcs@loeitech.ac.th</td>
            </tr>
            <tr>
              <td style={tdL}>ช่องทางร้องเรียน</td>
              <td style={tdR}>สำนักงานศึกษาธิการจังหวัดเลย หรือผ่านครูแนะแนวของสถานศึกษา</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="3. ข้อมูลส่วนบุคคลที่เก็บรวบรวม">
        <p style={{ fontWeight: 600 }}>ข้อมูลระบุตัวตน</p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>เลขประจำตัวประชาชน <b>(จัดเก็บในรูปแบบเข้ารหัส AES-256 เท่านั้น)</b></li>
          <li>วันเดือนปีเกิด</li>
          <li>รหัสประจำตัวนักเรียน / นักศึกษา</li>
          <li>ชื่อ-นามสกุล ชั้นเรียน โรงเรียน และสังกัด (จากฐานข้อมูลสถานศึกษา)</li>
        </ul>
        <p style={{ fontWeight: 600, marginTop: 8 }}>ข้อมูลด้านสุขภาพ (ข้อมูลอ่อนไหวตามมาตรา 26)</p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>คำตอบและคะแนนจากแบบประเมิน ST-5 (ความเครียด)</li>
          <li>คำตอบและคะแนนจากแบบประเมิน PHQ-A (ภาวะซึมเศร้าวัยรุ่น อายุ 11–20 ปี)</li>
          <li>คำตอบและคะแนนจากแบบประเมิน CDI (ภาวะซึมเศร้าในเด็ก อายุ 7–17 ปี)</li>
          <li>ระดับความเสี่ยงและการแจ้งเตือนที่เกี่ยวข้อง</li>
        </ul>
        <p style={{ fontWeight: 600, marginTop: 8 }}>ข้อมูลการใช้งาน</p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>บันทึกการเข้าใช้งาน (audit logs) ตามมาตรฐาน PDPA</li>
          <li>วันและเวลาที่ทำแบบประเมิน</li>
        </ul>
      </Section>

      <Section title="4. วัตถุประสงค์และฐานทางกฎหมายในการประมวลผล">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: "42%" }}>วัตถุประสงค์</th>
              <th style={thStyle}>ฐานทางกฎหมาย (พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>คัดกรองและติดตามสุขภาพจิตนักเรียน</td>
              <td style={tdStyle}>ความยินยอม (มาตรา 19, 26) / ผลประโยชน์สำคัญ (มาตรา 24(5))</td>
            </tr>
            <tr>
              <td style={tdStyle}>รายงานต่อครูแนะแนวและผู้บริหาร</td>
              <td style={tdStyle}>ผลประโยชน์อันชอบธรรม (มาตรา 24(6)) — ใช้ข้อมูลสรุปเชิงสถิติ</td>
            </tr>
            <tr>
              <td style={tdStyle}>แจ้งเตือนกรณีมีความเสี่ยงสูง (Suicide Risk)</td>
              <td style={tdStyle}>ผลประโยชน์สำคัญต่อชีวิต (มาตรา 24(5), 26(4)) — ดำเนินการทันที</td>
            </tr>
            <tr>
              <td style={tdStyle}>วางแผนโปรแกรมสุขภาพจิตระดับจังหวัด</td>
              <td style={tdStyle}>ผลประโยชน์สาธารณะ (มาตรา 24(4)) — ข้อมูลรวม ไม่ระบุตัวตน</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="5. การเปิดเผยข้อมูลส่วนบุคคล">
        <p>ระบบเปิดเผยข้อมูลส่วนบุคคลเฉพาะกรณีต่อไปนี้:</p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li><b>ครูแนะแนวและผู้บริหารโรงเรียน</b> — ผลสรุปภาพรวม ไม่ระบุตัวตน ยกเว้นกรณีความเสี่ยงสูง</li>
          <li><b>ผู้บริหารระดับจังหวัด</b> — ข้อมูลเชิงสถิติรวม ไม่มีการระบุตัวตนรายบุคคล</li>
          <li><b>กรณีฉุกเฉินด้านชีวิต</b> — เมื่อพบความเสี่ยงต่อชีวิต จะแจ้งผู้เกี่ยวข้องทันทีโดยไม่ผ่านคิว</li>
          <li><b>ตามคำสั่งศาลหรือหน่วยงานที่มีอำนาจ</b> — เฉพาะที่กฎหมายบังคับเท่านั้น</li>
        </ul>
        <p>ระบบ <b>ไม่</b> เปิดเผย จำหน่าย หรือถ่ายโอนข้อมูลส่วนบุคคลให้แก่บุคคลภายนอกเพื่อวัตถุประสงค์เชิงพาณิชย์</p>
      </Section>

      <Section title="6. การส่งหรือโอนข้อมูลไปต่างประเทศ">
        <p>
          ระบบ LEMCS จัดเก็บข้อมูลในเซิร์ฟเวอร์ภายในประเทศไทยทั้งหมด
          ไม่มีการส่งหรือโอนข้อมูลส่วนบุคคลไปยังต่างประเทศ
        </p>
      </Section>

      <Section title="7. ระยะเวลาการเก็บรักษาข้อมูล">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>ผลการประเมินสุขภาพจิต: ตลอดระยะเวลาที่อยู่ในสังกัดสถานศึกษา + 5 ปีนับจากสำเร็จการศึกษา</li>
          <li>บันทึกการเข้าใช้งาน (audit logs): 3 ปี</li>
          <li>ข้อมูลระบุตัวตน: ตามที่กฎหมายการศึกษาและ PDPA กำหนด</li>
        </ul>
        <p>เมื่อครบกำหนด ข้อมูลจะถูกลบหรือทำให้ไม่สามารถระบุตัวตนได้อย่างถาวร</p>
      </Section>

      <Section title="8. มาตรการรักษาความปลอดภัย">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>เข้ารหัสข้อมูลอ่อนไหว (เลขบัตรประชาชน) ด้วย AES-256 ทั้งในระหว่างส่งและจัดเก็บ</li>
          <li>การส่งข้อมูลทุกช่องทางผ่าน HTTPS / TLS</li>
          <li>การกำหนดสิทธิ์ตามบทบาท (RBAC) — ข้อมูลนักเรียนเข้าถึงได้เฉพาะบุคลากรที่มีสิทธิ์</li>
          <li>บันทึกการกระทำทุกรายการในระบบ (audit trail) ตามมาตรฐาน PDPA</li>
          <li>สำรองข้อมูลรายวันในพื้นที่จัดเก็บที่ปลอดภัย (MinIO, encrypted)</li>
          <li>จำกัดอัตราคำขอ (rate limiting) เพื่อป้องกัน brute-force attack</li>
        </ul>
      </Section>

      <Section title="9. สิทธิของเจ้าของข้อมูลส่วนบุคคล">
        <p>ท่านมีสิทธิตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 ดังนี้:</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { right: "สิทธิได้รับแจ้งข้อมูล", desc: "ทราบประเภทข้อมูลที่เก็บ วัตถุประสงค์ และช่องทางใช้สิทธิ (มาตรา 23)" },
            { right: "สิทธิเข้าถึงข้อมูล", desc: "ขอดูหรือขอสำเนาข้อมูลส่วนบุคคลของตนเอง (มาตรา 30)" },
            { right: "สิทธิแก้ไขข้อมูล", desc: "ขอแก้ไขข้อมูลที่ไม่ถูกต้อง ไม่ครบถ้วน หรือทำให้เข้าใจผิด (มาตรา 35)" },
            { right: "สิทธิลบข้อมูล (Right to Erasure)", desc: "ขอลบหรือทำลายข้อมูลเมื่อหมดความจำเป็น (มาตรา 33)" },
            { right: "สิทธิระงับการประมวลผล", desc: "ขอระงับการใช้ข้อมูลชั่วคราวในกรณีที่กฎหมายกำหนด (มาตรา 34)" },
            { right: "สิทธิโอนย้ายข้อมูล (Data Portability)", desc: "ขอรับข้อมูลในรูปแบบที่อ่านได้ด้วยเครื่อง (มาตรา 31)" },
            { right: "สิทธิคัดค้านการประมวลผล", desc: "คัดค้านการประมวลผลในบางกรณีที่กฎหมายอนุญาต (มาตรา 32)" },
            { right: "สิทธิถอนความยินยอม", desc: "ถอนได้ตลอดเวลา โดยไม่กระทบสิทธิที่ได้กระทำไปก่อนหน้า (มาตรา 19 วรรค 4)" },
            { right: "สิทธิร้องเรียน", desc: "ร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (มาตรา 73)" },
          ].map(r => (
            <div key={r.right} style={{
              padding: "7px 11px", background: "#f8fafc", borderRadius: 7,
              border: "1px solid #e2e8f0",
            }}>
              <div style={{ fontWeight: 600, fontSize: "0.78rem", color: C.text }}>{r.right}</div>
              <div style={{ fontSize: "0.74rem", color: C.muted, marginTop: 2 }}>{r.desc}</div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 10 }}>
          เพื่อใช้สิทธิข้างต้น กรุณาติดต่อ DPO ที่ <b>dpo-lemcs@loeitech.ac.th</b>
          หรือแจ้งผ่านครูแนะแนวของสถานศึกษา ระบบจะดำเนินการตอบสนองภายใน <b>30 วัน</b>
        </p>
      </Section>

      <Section title="10. ผู้เยาว์และผู้ปกครอง">
        <p>
          ระบบ LEMCS ให้บริการแก่นักเรียนที่อาจมีอายุต่ำกว่า 20 ปี (ผู้เยาว์ตามกฎหมาย)
          การใช้บริการในระบบนี้ดำเนินการโดยสถานศึกษาภายใต้โปรแกรมดูแลสุขภาพจิตระดับจังหวัด
          ผู้ปกครองที่ต้องการข้อมูลเพิ่มเติมหรือขอถอนความยินยอม
          กรุณาติดต่อสถานศึกษาหรือ DPO ตามที่ระบุไว้
        </p>
      </Section>

      <Section title="11. การแก้ไขนโยบาย">
        <p>
          ผู้ควบคุมข้อมูลอาจแก้ไขนโยบายความเป็นส่วนตัวเป็นครั้งคราว เพื่อให้สอดคล้องกับ
          การเปลี่ยนแปลงทางกฎหมายหรือการดำเนินงาน การแก้ไขที่มีนัยสำคัญจะแจ้งผ่านระบบ
          นโยบายฉบับปัจจุบันมีผลบังคับใช้ตั้งแต่ <b>วันที่ 1 มีนาคม 2569</b>
        </p>
      </Section>
    </div>
  );
}

// ── Icon components ──────────────────────────────────────────────

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        stroke="rgba(199,210,254,0.9)"
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        stroke="white" d="M9 12l2 2 4-4"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"
        stroke="white" d="M5 13l4 4L19 7"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
        stroke="currentColor" d="M6 18L18 6M6 6l12 12"/>
    </svg>
  );
}

// ── Main component ───────────────────────────────────────────────

export default function ConsentModal({ onAccept, onDecline, readOnly = false, onClose }: ConsentModalProps) {
  const [tab, setTab] = useState<Tab>("terms");
  const [checked, setChecked] = useState(false);

  const handleClose = () => {
    if (onClose) onClose();
    else onDecline();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(15,23,42,0.75)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px",
    }}>
      <div style={{
        background: "white", borderRadius: 20,
        width: "100%", maxWidth: 700,
        maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 80px rgba(0,0,0,0.28), 0 8px 24px rgba(0,0,0,0.12)",
        overflow: "hidden",
        fontFamily: "inherit",
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: "22px 28px 0",
          background: "linear-gradient(135deg, #1e40af 0%, #4338ca 50%, #7c3aed 100%)",
          color: "white",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5 }}>
                <ShieldIcon />
                <span style={{ fontWeight: 800, fontSize: "1.05rem", letterSpacing: "-0.2px" }}>
                  ข้อตกลงการใช้บริการและนโยบายความเป็นส่วนตัว
                </span>
              </div>
              <p style={{ fontSize: "0.75rem", color: "rgba(199,210,254,0.85)", margin: 0 }}>
                ระบบ LEMCS · สำนักงานศึกษาธิการจังหวัดเลย · ภายใต้ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
              </p>
            </div>
            {readOnly && (
              <button
                onClick={handleClose}
                style={{
                  background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 8, cursor: "pointer", padding: "6px 8px",
                  color: "white", display: "flex", alignItems: "center",
                  flexShrink: 0, marginLeft: 12,
                }}
              >
                <XIcon />
              </button>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["terms", "privacy"] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "9px 20px",
                  background: tab === t ? "white" : "rgba(255,255,255,0.12)",
                  color: tab === t ? "#4338ca" : "rgba(255,255,255,0.82)",
                  border: "none", borderRadius: "8px 8px 0 0",
                  fontWeight: tab === t ? 700 : 500,
                  fontSize: "0.8rem", cursor: "pointer",
                  transition: "all .18s", fontFamily: "inherit",
                }}
              >
                {t === "terms" ? "ข้อตกลงการใช้บริการ" : "นโยบายความเป็นส่วนตัว"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "24px 28px",
        }}>
          {tab === "terms" ? <TermsContent /> : <PrivacyContent />}
        </div>

        {/* ── Footer ── */}
        {!readOnly ? (
          <div style={{
            padding: "16px 28px 22px",
            borderTop: "1px solid #e2e8f0",
            background: "#f8fafc",
            flexShrink: 0,
          }}>
            {/* Consent checkbox */}
            <div
              role="checkbox"
              aria-checked={checked}
              tabIndex={0}
              onClick={() => setChecked(c => !c)}
              onKeyDown={e => e.key === " " && setChecked(c => !c)}
              style={{
                display: "flex", alignItems: "flex-start", gap: 11,
                padding: "12px 14px", borderRadius: 10, marginBottom: 14,
                background: checked ? "rgba(79,70,229,0.05)" : "rgba(0,0,0,0.02)",
                border: `1.5px solid ${checked ? "rgba(79,70,229,0.25)" : "#e2e8f0"}`,
                cursor: "pointer", transition: "all .15s",
              }}
            >
              <div style={{
                width: 19, height: 19, borderRadius: 5, flexShrink: 0,
                border: `2px solid ${checked ? "#4f46e5" : "#cbd5e1"}`,
                background: checked ? "#4f46e5" : "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .15s", marginTop: 1,
              }}>
                {checked && <CheckIcon />}
              </div>
              <span style={{ fontSize: "0.79rem", lineHeight: 1.65, color: "#1e293b", userSelect: "none" }}>
                ข้าพเจ้าได้อ่านและเข้าใจ<b>ข้อตกลงการใช้บริการ</b>และ<b>นโยบายความเป็นส่วนตัว</b>ข้างต้นแล้ว
                และยินยอมให้ระบบ LEMCS เก็บรวบรวมและประมวลผลข้อมูลส่วนบุคคลของข้าพเจ้าตามวัตถุประสงค์
                และเงื่อนไขที่ระบุไว้ ข้าพเจ้ารับทราบว่าสามารถถอนความยินยอมได้ตลอดเวลา
              </span>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={onDecline}
                style={{
                  flex: 1, padding: "11px 16px",
                  background: "white", border: "1.5px solid #e2e8f0",
                  borderRadius: 10, cursor: "pointer",
                  fontWeight: 600, fontSize: "0.84rem", color: C.muted,
                  transition: "border-color .15s, color .15s", fontFamily: "inherit",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.color = C.text; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = C.muted; }}
              >
                ไม่ยินยอม
              </button>
              <button
                onClick={onAccept}
                disabled={!checked}
                style={{
                  flex: 2, padding: "11px 16px",
                  background: checked
                    ? "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)"
                    : "#e2e8f0",
                  border: "none", borderRadius: 10,
                  cursor: checked ? "pointer" : "not-allowed",
                  fontWeight: 700, fontSize: "0.84rem",
                  color: checked ? "white" : C.subtle,
                  boxShadow: checked ? "0 4px 16px rgba(79,70,229,0.3), 0 1px 3px rgba(0,0,0,.08)" : "none",
                  transition: "all .25s", fontFamily: "inherit",
                }}
              >
                ยินยอมและเริ่มทำแบบประเมิน
              </button>
            </div>

            <p style={{
              textAlign: "center", fontSize: "0.69rem", color: C.subtle,
              marginTop: 12, marginBottom: 0,
            }}>
              สายด่วนสุขภาพจิต กรมสุขภาพจิต <b>1323</b> · พร้อมให้บริการตลอด 24 ชั่วโมง
            </p>
          </div>
        ) : (
          <div style={{
            padding: "14px 28px 20px", borderTop: "1px solid #e2e8f0",
            background: "#f8fafc", display: "flex", justifyContent: "flex-end",
            flexShrink: 0,
          }}>
            <button
              onClick={handleClose}
              style={{
                padding: "10px 28px",
                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                border: "none", borderRadius: 10, cursor: "pointer",
                fontWeight: 700, fontSize: "0.84rem", color: "white",
                boxShadow: "0 4px 16px rgba(79,70,229,0.3)",
                fontFamily: "inherit",
              }}
            >
              ปิด
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
