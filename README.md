# Fiber Monitor & Wi-Fi Tracker (ZTE F680)

نظام مراقبة والتحكم في شبكة الفايبر (ZTE F680) مقسوم على جزئين:
1. **`agent/`**: سكربت Python خفيف كيشتغل 24/24 على الهاتف عبر `Termux` وكيراقب الراوتر ZTE F680، بصمة الأجهزة (DNA / mDNS / SSDP)، وحظر `L2 ACL` + `Auto-Reblock` عند تغيير الـ MAC.
2. **`web/`**: لوحة تحكم Next.js 15 جاهزة للنشر على **Vercel** لعرض المتصلين، فحص الكابلات، الخريطة التفاعلية، وحظر الأجهزة عن بُعد.

---

## 1. النشر على Vercel

1. ارفع المشروع إلى GitHub ثم استورده في **Vercel** وحدد:
   - **Root Directory**: `web`
   - **Framework Preset**: `Next.js`
2. في إعدادات المشروع على Vercel ← **Settings → Environment Variables** أضف:
   - `DATABASE_URL`: رابط قاعدة بيانات **Neon PostgreSQL** (أو `UPSTASH_REDIS_REST_URL` و `UPSTASH_REDIS_REST_TOKEN`).
   - `ADMIN_PASSWORD`: كلمة السر للدخول إلى لوحة التحكم.
   - `AGENT_SECRET`: رمز سري طويل مشترك بين الهاتف والسيرفر (نفس `api_secret` في `agent/config.json`).
3. اضغط **Deploy** (يتم إنشاء جدول `monitor_state` في Neon تلقائياً عند أول تشغيل).

---

## 2. إعداد الوكيل على الهاتف (`agent/` في Termux)

1. ثبّت **Termux** و**Termux:Boot** على هاتف أندرويد متصل بالشبكة المحلية للراوتر.
2. أنشئ ملف الإعدادات من القالب:
   ```bash
   cd agent
   bash setup_termux.sh
   cp config.example.json config.json
   cp devices.example.json devices.json
   ```
3. عدّل `config.json`:
   - `router_url` / `router_user` / `router_password`: بيانات الدخول إلى ZTE F680 (`http://192.168.1.1`).
   - `api_url`: رابط Vercel ديالك (أو `http://192.168.1.x:3000` للتشغيل المحلي).
   - `api_secret`: نفس قيمة `AGENT_SECRET` في Vercel.
   - *(اختياري)* `upstash_url` و `upstash_token` للمزامنة المباشرة مع Redis.
4. شغّل المراقبة:
   ```bash
   python monitor.py
   ```
