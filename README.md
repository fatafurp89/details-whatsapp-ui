# واجهة واتساب ديتيلز — إعادة بناء من لوفابل (TanStack Start)

واجهة أمامية فقط (SSR + API same-origin) لخلفية `details-whatsapp` الحالية على 127.0.0.1:3400.
لا تتضمن قاعدة بيانات ولا منطق أعمال — كل الاستدعاءات إلى `/api/*` تذهب لنفس الأصل (same-origin)
عبر نفس كوكي جلسة بوابة ديتيلز.

## البناء
```
npm install
NITRO_PRESET=node-server npm run build
node .output/server/index.mjs   # PORT/HOST عبر env
```

## النشر
راجع `deploy/install.sh` — يبني التطبيق، يثبّت `details-whatsapp-ui.service` على المنفذ 3401،
ويستبدل nginx tunnel على سيرفر التطبيقات بإعداد يقسّم المسارات: `/api/*`, `/webhook`, `/healthz`,
`/internal/*` تبقى على الخلفية القديمة (3400) دون أي تغيير، وكل شيء آخر يذهب للواجهة الجديدة (3401).
نسخة احتياطية تلقائية من الإعداد القديم في `*.tunnel.bak` للتراجع الفوري عند الحاجة.
