# Frontend (Host / Viewer)

ไฟล์ในโฟลเดอร์นี้เป็นหน้าเว็บแบบ static (เอาไปวางบน Cloudflare Pages / R2 / S3 / หรือโฮสต์ที่ไหนก็ได้)

## ค่าที่ต้องแก้ (ครั้งเดียว)
เปิด `config.js` แล้วตั้งค่า
- `API_BASE` = `https://api.mydd.com`

## ลิงก์ตัวอย่าง
- Host: `host.html?channel=test1&liveId=test1&uid=1`
- Viewer: `viewer.html?channel=test1&liveId=test1`

> **หมายเหตุ:** Viewer จะสุ่ม uid อัตโนมัติ ถ้าอยากกำหนดเองใส่ `&uid=123`
