# Tony's Kitchen 🍳🥢
### ระบบขายหน้าร้าน (POS) & วิเคราะห์ต้นทุนอาหาร (Food Cost) สำหรับร้านอาหารไทย
**ทำงานแบบ Offline 100% | จัดเก็บข้อมูลในเครื่องผ่าน IndexedDB | ใช้งานฟรี ไม่มีค่าใช้จ่าย**

---

## 🇹🇭 บทนำและภาพรวมของระบบ (Overview)

**Tony's Kitchen** ถูกออกแบบขึ้นมาเพื่อเจ้าของร้านอาหารไทย คาเฟ่ และร้านอาหารขนาดเล็กถึงขนาดกลาง โดยรวม 2 โมดูลสำคัญไว้ในแอปเดียว:
1. **ระบบขายหน้าร้าน (POS & Table Management)**: ผังโต๊ะตามโซน (Indoor, Outdoor, Bar, VIP), รับออเดอร์, ส่งรายการเข้าครัว (KDS), ย้ายโต๊ะ/รวมบิล, แยกชำระบิล (Split Bill), คิดเงินสดพร้อมคำนวณเงินทอน, สร้าง QR พร้อมเพย์ไดนามิกตามยอดเงินจริง (PromptPay QR), พิมพ์ใบเสร็จความร้อน (80mm/58mm), ระบบสมาชิกสะสมแต้ม, และจัดการกะขายหน้าร้าน (Shifts)
2. **ระบบต้นทุนอาหาร & คลังวัตถุดิบ (Food Cost Module)**: คลังวัตถุดิบคำนวณ % Yield (หักเศษตัดแต่ง/ลอกเปลือก), ผูกสูตรอาหารมาตรฐาน (Standard Recipes), คิดต้นทุนวัตถุดิบคู่กับค่าแรงและค่าแพ็กเกจจิ้ง, จำลองตั้งราคาขายตามเป้า % Food Cost, และซิงก์ต้นทุนเข้าเมนูขายอัตโนมัติ
3. **ระบบวิเคราะห์และรายงานการเงิน (Reports & P&L)**: สรุปยอดขายรายวัน, งบกำไรขาดทุนเบื้องต้น (P&L: รายรับ - COGS - ค่าใช้จ่ายร้าน), เมทริกซ์วิเคราะห์เมนูทำเงิน (Menu Engineering: Stars, Plowhorses, Puzzles, Dogs)

---

## ⚠️ คำเตือนเรื่องความปลอดภัยของข้อมูล (Important Data Warning)

> **ข้อมูลทั้งหมดถูกจัดเก็บไว้ใน Browser (IndexedDB) บนเครื่องและเบราว์เซอร์นี้เท่านั้น!**  
> ไม่มีการส่งข้อมูลขึ้น Cloud หรือ Server ภายนอก หากท่านทำการล้างแคชเบราว์เซอร์ (Clear Browsing Data) หรือเปลี่ยนอุปกรณ์ ข้อมูลจะไม่ตามไปด้วย  
> **คำแนะนำ:** กรุณากดปุ่ม **"ตั้งค่า (Settings) → สำรองข้อมูล (Backup/Export)"** เพื่อดาวน์โหลดไฟล์ `.json` เก็บไว้เป็นประจำ และสามารถกด **"นำเข้าข้อมูล (Import/Restore)"** เพื่อย้ายไปยังอุปกรณ์อื่นได้ทันที

---

## 🚀 วิธีการติดตั้งและรันในเครื่อง (Local Development)

ระบบใช้ Node.js (แนะนำเวอร์ชัน 20 หรือสูงกว่า) และ Vite ไม่ต้องตั้งค่า Environment Variable ใดๆ ทั้งสิ้น:

```bash
# 1. Clone หรือเปิดโปรเจกต์ใน Terminal
cd tonys-kitchen

# 2. ติดตั้ง Dependencies (ทั้งหมดเป็น Free Open-Source Libraries)
npm install

# 3. เริ่มต้น Local Dev Server
npm run dev

# 4. เปิดเบราว์เซอร์ไปที่ http://localhost:3000 หรือ URL ที่ระบบแสดงผล
```

### การตรวจสอบและ Build สำหรับ Production:
```bash
# ตรวจสอบ Typecheck
npm run lint

# Build เป็นไฟล์ Static HTML/JS/CSS พร้อม Deploy
npm run build

# ทดสอบรันไฟล์ที่ Build แล้ว
npm run preview
```

---

## 🌐 ขั้นตอนการขึ้นระบบบน GitHub Pages (Step-by-Step Deploy)

โปรเจกต์นี้ตั้งค่า `base: './'` และมีไฟล์ GitHub Actions Workflow (`.github/workflows/deploy.yml`) เตรียมไว้แล้ว สามารถ Deploy ได้ทันทีโดยไม่ต้องแก้ไขโค้ด:

1. **สร้าง Git Repository ใหม่บน GitHub**:
   - ไปที่ [github.com/new](https://github.com/new) ตั้งชื่อ Repository เช่น `tonys-kitchen`
2. **Push โค้ดทั้งหมดขึ้น Branch `main`**:
   ```bash
   git init
   git add .
   git commit -m "Initial release Tony's Kitchen POS & Food Cost"
   git branch -M main
   git remote add origin https://github.com/<YOUR_USERNAME>/tonys-kitchen.git
   git push -u origin main
   ```
3. **เปิดใช้งาน GitHub Pages ใน Repository**:
   - ไปที่แถบ **Settings** ของ Repository บน GitHub
   - ในเมนูด้านซ้าย เลือก **Pages**
   - ในหัวข้อ **Build and deployment > Source** ให้เปลี่ยนจาก "Deploy from a branch" เป็น **"GitHub Actions"**
4. **รอระบบ Build & Deploy**:
   - ไปที่แถบ **Actions** เพื่อดูสถานะการทำงาน
   - เมื่อสำเร็จ URL ของเว็บไซต์จะปรากฏที่หน้า Pages (เช่น `https://<YOUR_USERNAME>.github.io/tonys-kitchen/`)
   - สามารถเปิดใช้งานผ่านคอมพิวเตอร์ แท็บเล็ต หรือสมาร์ตโฟนได้ทันที

---

## 📋 ข้อสมมติฐานในการออกแบบ (Assumptions)

1. **สถาปัตยกรรม Single-User & Offline-First**: ออกแบบสำหรับร้านขนาดเล็กที่มีแคชเชียร์หรือผู้จัดการร้านใช้งาน 1 คนต่อเครื่อง ไม่มีการแยกระบบหลายบทบาท (Role Permission) หรือล็อกอินด้วยรหัสผ่าน เพื่อความสะดวกรวดเร็วในการทำงานหน้าร้าน
2. **ระบบคิดต้นทุนสูตรอาหาร**: ต้นทุนอาหารคำนวณจากสูตรมาตรฐาน (Standard Recipe) ของแต่ละเมนู และปรับตาม % Yield ของวัตถุดิบจริง ณ วันที่บันทึก
3. **การพิมพ์ใบเสร็จและความร้อน**: ใช้คำสั่ง `window.print()` ร่วมกับ Print CSS Media Query ที่ออกแบบสำหรับกระดาษความร้อนมาตรฐานขนาด 80mm และ 58mm โดยผู้ใช้สามารถเลือกเครื่องพิมพ์ผ่านหน้าต่าง Print Dialog ของเบราว์เซอร์
4. **PromptPay EMVCo QR Code**: การสร้าง QR Code เป็นไปตามมาตรฐาน EMVCo ของธนาคารแห่งประเทศไทย โดยคำนวณ Checksum CRC-16 ภายในเครื่อง ลูกค้าสามารถสแกนด้วยแอปธนาคารไทยได้ทุกธนาคาร
5. **การจัดการรูปภาพเมนู**: บีบอัดรูปภาพผ่าน HTML Canvas อัตโนมัติ (ขนาดด้านยาวสุดไม่เกิน 480px, คุณภาพ JPEG ~0.7) เพื่อประหยัดพื้นที่จัดเก็บบน IndexedDB ของเบราว์เซอร์

---

## 🛑 ข้อจำกัดของระบบ (Limitations)

- **ไม่มี Cloud Auto-Sync ข้ามอุปกรณ์แบบ Real-time**: ข้อมูลถูกเก็บใน IndexedDB ของเครื่องที่เปิดใช้งาน หากต้องการย้ายเครื่องหรือแชร์ข้อมูล ต้องใช้วิธี Export / Import ไฟล์ JSON
- **การพิมพ์ใบเสร็จ**: ขึ้นอยู่กับไดรเวอร์เครื่องพิมพ์และเบราว์เซอร์ (ต้องกดพิมพ์ผ่าน Print Dialog ของระบบปฏิบัติการ)
- **การล้างข้อมูลเบราว์เซอร์**: หากผู้ใช้ล้าง Storage/IndexedDB ของเบราว์เซอร์ ข้อมูลจะถูกลบ (ควรเปิด Persistent Storage และหมั่น Export สำรองข้อมูล)
- **การยืนยันยอดเงินโอนเข้าบัญชี**: ระบบสร้าง QR Code พร้อมเพย์ตามยอดเงินจริง แต่แคชเชียร์ต้องตรวจสอบสลิปการโอนเงินหรือ SMS แจ้งเตือนเงินเข้าของธนาคารด้วยตนเอง เนื่องจากไม่มีการเชื่อมต่อ API ของธนาคารภายนอก

---

## 🇬🇧 English Summary

**Tony's Kitchen** is an all-in-one, offline-first Point of Sale (POS) and Food Cost Management suite specifically designed for Thai restaurants and cafes.

### Key Highlights:
- **100% Free & Offline-Ready**: Zero external API dependencies, zero backend server costs. All operational data is stored locally in the browser using IndexedDB (`idb`).
- **Connected Modules**: Seamless workflow between Ingredient Inventory, Recipe Costing (% Yield, Labor, Packaging), Floor Plan Tables, POS Ordering, KDS Kitchen Display, Thermal Receipts, Dynamic PromptPay QR, CRM Members, and P&L Financial Reporting.
- **GitHub Pages Ready**: Out-of-the-box GitHub Actions workflow included. Builds cleanly with `npm run build` using relative paths (`base: './'`).
