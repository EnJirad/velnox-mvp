# VELNOX — Incident Response (spec §91–93)

Version: 1.0 · Phase 9

## 1. Severity model

| Level | ความหมาย | ตัวอย่าง | ตอบสนอง |
|---|---|---|---|
| **P0** | Critical — สูญเงิน/ข้อมูล/ระบบล่ม | Payment สูญเงิน · Order สูญหาย · Database corruption · Auth พัง | ตอบสนองทันที (นาที), rollback, แจ้งทีมทั้งหมด |
| **P1** | High — ฟีเจอร์หลักใช้งานไม่ได้ | Checkout ล้มเหลว · Seller dashboard พัง · API ล่ม | ตอบสนอง < 1 ชม., rollback/ hotfix |
| **P2** | Medium — ฟีเจอร์รองบกพร่อง | Tracking ช้า · notification สาย · UI บางจุดพัง | แก้ในรอบถัดไป (SLA < 1 วัน) |
| **P3** | Low — cosmetic / ไม่กระทบธุรกิจ | typo, รูปโหลดช้า, a11y จุดเล็ก | queue ตามปกติ |

## 2. Response flow (spec §92)

```
1. DETECT       — monitoring/alert/ผู้ใช้แจ้ง
2. CONFIRM      — ยืนยันว่าเกิดจริง + ขอบเขต (ใครกระทบ กี่ราย)
3. CONTAIN      — ลดผลกระทบ: rollback / maintenance mode / หยุดรับ order (P0)
4. FIX          — hotfix ผ่าน CI ปกติ (ไม่ bypass review)
5. VERIFY       — smoke test + db:consistency + ตรวจ ledger ไม่แตก
6. COMMUNICATE  — แจ้ง user (ถ้าจำเป็น) + ทีม ตาม severity
7. POSTMORTEM   — บันทึก (P0/P1 ทุกครั้ง) ตาม template ล่าง
```

## 3. บทบาท (ตัวอย่างสำหรับทีมเล็ก)

- **On-call**: คนแรกที่รับ alert → detect/confirm/contain
- **Lead**: ประสานงาน, ตัดสินใจ rollback/communication
- **ผู้แก้ไข**: fix + verify
- ทุกคนบันทึก timeline ใน incident log

## 4. Postmortem template (spec §93)

```md
# Postmortem — <INCIDENT ID>

- Date:              YYYY-MM-DD HH:mm (UTC)
- Severity:          P0/P1/P2
- Impact:            กี่ user/order/บาท กระทบ
- Duration:          เริ่ม → จบ
- What happened:     ลำดับเหตุการณ์ (timeline)
- Why happened:      root cause (5 Whys)
- Impact detail:     ตัวเลขจริง (orders, payments, data)
- Root cause:        สรุป 1–2 บรรทัด
- Fix:               อะไร แก้ยังไง (PR link)
- Prevention:        1–3 การกระทำเพื่อไม่ให้เกิดซ้ำ (ตรวจ/test/monitor/process)
- Open items:        สิ่งที่ยังค้าง
```

## 5. Communication

- P0: แจ้งทุกช่องทางทันที (Slack/email) + update ทุก 30 นาที
- P1: update รายชั่วโมง
- หลังจบ: ส่ง postmortem ให้ทีมภายใน 48 ชม.

## 6. เอกสารอ้างอิง

- Rollback: `rollback.md` · Backup/restore: `backup.md` · Smoke test: `../E2E-TESTING.md` · Metrics: `monitoring.md`
