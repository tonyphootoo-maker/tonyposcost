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

## 9. 🛑 ข้อจำกัดของระบบที่ระบุอย่างตรงไปตรงมา (System Limitations & Honest Architecture)

> **Tony's Kitchen ยึดหลักความโปร่งใสและตรงไปตรงมาต่อผู้ใช้งาน**: ระบบทำงานแบบ Local-First 100% ไม่มีเซิร์ฟเวอร์คลาวด์กลาง จึงมีข้อจำกัดทางสถาปัตยกรรมที่ผู้ใช้งานควรทราบดังนี้ (ไม่มีการหลอกฟีเจอร์ที่ไม่สามารถทำได้จริง):

1. **ไม่มีการซิงก์ข้อมูลสดข้ามหลายอุปกรณ์ หรือดูยอดขายทางไกลแบบ Real-time (No live multi-device sync or real-time remote sales viewing):**
   - ตัวระบบไม่มี Backend Server และไม่มี Cloud Database ข้อมูลทุกตารางถูกจัดเก็บไว้ใน IndexedDB ภายในเบราว์เซอร์ของเครื่องนั้นๆ
   - **แนวทางปฏิบัติสำหรับเจ้าของร้าน:**
     - สามารถกดปุ่ม **"คัดลอกสรุปยอดส่ง LINE (Copy summary for LINE)"** ในหน้ารายงานเพื่อคัดลอกสรุปยอดขายรายวันส่งเข้ากลุ่ม LINE ร้านได้ทันที
     - ใช้ระบบ **"Export ข้อมูล (JSON)"** จากเมนูตั้งค่า แล้วนำไฟล์ไป **"Import"** บนคอมพิวเตอร์หรือโทรศัพท์มือถือเครื่องอื่นเพื่อเปิดดูรายงานเต็มรูปแบบ
2. **การพิมพ์ใบเสร็จผ่าน Print Dialog ของเบราว์เซอร์ (58mm / 80mm CSS); ไม่มีการส่งคำสั่งดิบ ESC/POS Direct/Silent Network Printing:**
   - การพิมพ์ใบเสร็จความร้อนทั้งขนาด 58 มม. และ 80 มม. ทำงานผ่านคำสั่งมาตรฐาน `window.print()` ร่วมกับ CSS `@media print` ซึ่งจะแสดงหน้าต่างพิมพ์ของระบบปฏิบัติการ/เบราว์เซอร์ให้กดยืนยัน
   - ระบบไม่ได้เชื่อมต่อไดรเวอร์ระดับล่างแบบ ESC/POS Raw Binary ผ่าน TCP Socket หรือ Bluetooth SPP โดยตรง
   - **เคล็ดลับสำหรับการพิมพ์เงียบอัตโนมัติ (Kiosk Printing Tip):** บนคอมพิวเตอร์ Windows/Mac สามารถเปิด Google Chrome ด้วยพารามิเตอร์ `--kiosk --kiosk-printing` เพื่อให้เครื่องพิมพ์ใบเสร็จออกทันทีโดยไม่ต้องผ่านหน้าต่าง Print Dialog
3. **การชำระเงินด้วยบัตรและ E-Wallet เป็นการบันทึกสถานะด้วยตนเอง; ไม่มีการเชื่อมต่อ Payment Gateway และไม่มีการตรวจสอบยอดเงินพร้อมเพย์อัตโนมัติกับธนาคาร:**
   - รายการชำระเงินผ่านบัตรเครดิต/เดบิต และกระเป๋าเงินดิจิทัล (E-Wallet) เป็นเพียงการบันทึกประเภทการจ่ายในระบบแคชเชียร์เท่านั้น ไม่มีการต่อเครื่องรูดบัตร EDC หรือ Gateway ภายนอก (เช่น 2C2P, Omise, GB Prime Pay)
   - QR Code พร้อมเพย์สร้างขึ้นตามมาตรฐานสากล EMVCo พร้อม Checksum CRC-16 ถูกต้องตามยอดเงินจริง แต่**ไม่มี Webhook/API ยืนยันยอดเงินโอนเข้ากับธนาคารโดยอัตโนมัติ** แคชเชียร์ต้องตรวจสอบสลิปโอนเงินหรือการแจ้งเตือนจากแอปธนาคารด้วยตนเองก่อนกดยืนยันรับเงิน
4. **ระบบสั่งอาหารออนไลน์ / QR สั่งอาหารที่โต๊ะโดยลูกค้า ยังไม่ได้เปิดทำงานแบบสด (Online ordering/QR ordering by customers is NOT live):**
   - ระบบไม่ได้เปิดรับออเดอร์สดจากลูกค้าภายนอกผ่านอินเทอร์เน็ต เนื่องจากไม่มีเซิร์ฟเวอร์รับการเชื่อมต่อจากภายนอก
   - หน้าต่าง **"ออเดอร์ออนไลน์ (Online Orders)"** ทำหน้าที่เป็นกล่องข้อความขาเข้า (Order Inbox), การแจ้งเตือนออเดอร์ และหน้าต่างนำเข้าคำสั่งซื้อผ่าน JSON เพื่อเตรียมพร้อมสำหรับเชื่อมต่อกับแอปสั่งอาหารของร้านในอนาคต
5. **ระบบรองรับการใช้งานโดยให้อุปกรณ์เครื่องเดียวเป็นศูนย์กลางความถูกต้องของข้อมูล (Single device as the source of truth):**
   - ตัวระบบออกแบบมาให้เครื่องแคชเชียร์หลักของร้านเป็นศูนย์กลางข้อมูลหลักเพียงเครื่องเดียว
   - ไม่แนะนำให้บันทึกการขายแยกกันหลายเครื่องในกะเดียวกัน เพราะฐานข้อมูล IndexedDB ในแต่ละเบราว์เซอร์จะแยกจากกันอย่างสิ้นเชิง

---

## 🇬🇧 English Summary & Honest Limitations

**Tony's Kitchen** is an all-in-one, offline-first Point of Sale (POS) and Food Cost Management suite specifically designed for Thai restaurants and cafes.

### Key Architecture Highlights:
- **100% Free & Offline-Ready**: Zero external API dependencies, zero backend server costs. All operational data is stored locally in the browser using IndexedDB (`idb`).
- **Connected Modules**: Seamless workflow between Ingredient Inventory, Recipe Costing (% Yield, Labor, Packaging), Floor Plan Tables, POS Ordering, KDS Kitchen Display, Thermal Receipts, Dynamic PromptPay QR, CRM Members, and P&L Financial Reporting.
- **GitHub Pages Ready**: Out-of-the-box GitHub Actions workflow included. Builds cleanly with `npm run build` using relative paths (`base: './'`).

### 🛑 Honest System Limitations (Do Not Fake These Features):
1. **No live multi-device sync or real-time remote sales viewing:**
   - There is no central server or cloud database.
   - For remote monitoring, owners can use the built-in **"Copy summary for LINE"** button to paste daily summaries into messaging chats, or perform **JSON Export / Import** to view reports on other devices.
2. **Browser-based thermal printing (58mm / 80mm CSS):**
   - Printing uses browser print dialogs (`window.print()`) styled via `@media print`.
   - There is no direct TCP/Bluetooth raw ESC/POS binary printing.
   - *Tip:* Users running Chrome on dedicated POS terminals can launch Chrome with `--kiosk --kiosk-printing` for one-click silent printing.
3. **Manual payment recording & no bank webhook verification:**
   - Card and e-wallet payments are recorded manually for bookkeeping; no external EDC terminal or payment gateway integrations exist.
   - Dynamic PromptPay QR generates standard EMVCo payloads with accurate CRC-16 checksums, but does not connect to banking APIs to auto-verify transactions. Cashiers must verify transfer slips manually.
4. **Customer online ordering is NOT live:**
   - Only the Order Inbox, notification system, and JSON import interface are active, prepared for future integration with shop-owned ordering backends.
5. **Single device as the source of truth:**
   - The primary cashier terminal serves as the authoritative database. Multi-terminal concurrent writes without an external database are not supported.

