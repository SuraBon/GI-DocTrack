# doc track

ระบบติดตามพัสดุแบบ React + Google Apps Script + Google Sheet

## Setup

1. คัดลอก `.env.example` เป็น `.env`
2. ตั้งค่า `VITE_GAS_URL` และ `VITE_GAS_API_KEY`
3. ใน Google Apps Script ให้รัน `setupApiKey('คีย์แบบสุ่มยาว')` หรือบันทึก Script Property ชื่อ `API_KEY` ให้ตรงกับ `VITE_GAS_API_KEY`
4. ถ้าต้องการเก็บไฟล์/ชีตรายปีในโฟลเดอร์ Drive เฉพาะ ให้ตั้ง Script Property ชื่อ `DOC_TRACK_FOLDER_ID`
5. ติดตั้ง dependency และรัน

```bash
npm install
npm run dev
```

## Deploy (Vercel)

- Import repo เข้า Vercel แล้วตั้งค่า
  - **Framework Preset**: Vite
  - **Build Command**: `pnpm build` (หรือ `npm run build`)
  - **Output Directory**: `dist`
- ตัวโปรเจกต์มี `vercel.json` เพื่อทำ SPA routing (refresh แล้วไม่ 404)
- อย่าลืมตั้ง Environment Variables ใน Vercel:
  - `VITE_GAS_URL`
  - `VITE_GAS_API_KEY`
- `VITE_GAS_API_KEY` อยู่ฝั่ง browser จึงไม่ใช่ secret ที่แท้จริง ควรใช้ร่วมกับ token login, role checks, และ rate limiting ใน Apps Script เสมอ

## Scripts

- `npm run dev` - รัน local development
- `npm run build` - build frontend
- `npm run check` - TypeScript check
- `npm run lint` - alias ไปที่ type-check
- `npm run test` - watch tests
- `npm run test:run` - run tests ครั้งเดียว
