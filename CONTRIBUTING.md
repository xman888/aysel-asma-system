# دليل المساهمة

شكراً لاهتمامك بالمشروع! هذا الدليل سيساعدك على المساهمة بشكل فعال.

## كيفية المساهمة

### 1. Fork المشروع
```bash
git clone https://github.com/xman888/aysel-asma-system.git
cd aysel-asma-system
git checkout -b feature/your-feature-name
```

### 2. الالتزام ببعض المعايير
- اكتب أكواد نظيفة وقابلة للقراءة
- أضف تعليقات للأكواد المعقدة
- استخدم الأسماء الوصفية للمتغيرات
- اتبع نمط الأكواد الموجودة

### 3. قبل الـ Commit
- تأكد من أن الأكواد تعمل بشكل صحيح
- اختبر جميع الحالات الممكنة
- أضف رسالة commit واضحة

```bash
git add .
git commit -m "إضافة/تحديث [الميزة]"
git push origin feature/your-feature-name
```

### 4. إرسال Pull Request
- اشرح التغييرات التي قمت بها
- اذكر أي مشاكل تم حلها
- أرفق لقطات شاشة إن أمكن

## معايير البرمجة

### JavaScript/Node.js
```javascript
// استخدم const بدلاً من var
const myVariable = 'value';

// استخدم arrow functions
const myFunction = () => {
  // كود
};

// أضف معالجة الأخطاء
try {
  // كود
} catch (error) {
  logger.error('وصف الخطأ:', error.message);
}
```

### SQL
```sql
-- استخدم قروس صغيرة للكلمات الرئيسية
SELECT * FROM users WHERE status = 'active';

-- استخدم الفهارس للبحث السريع
CREATE INDEX idx_user_email ON users(email);
```

## الإبلاغ عن الأخطاء

إذا وجدت مشكلة:
1. تحقق من أنه لم يتم إبلاغ عنه من قبل
2. اذكر طريقة تكرار المشكلة
3. أرفق رسالة الخطأ الكاملة
4. ذكر إصدار البرنامج والنظام

---

**شكراً على مساهمتك!** 🙏
