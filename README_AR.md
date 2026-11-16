# Next GPT Developer Suite v0.2

مجموعة أدوات مفتوحة المصدر لبناء وكلاء الذكاء الاصطناعي واختبارهم وإدارة مشاريعهم بأمان.

**الحالة:** نسخة أولية قابلة للتشغيل محليًا، وليست منصة مكتملة أو خدمة متصلة تلقائيًا بـ OpenAI أو Claude أو Manus.

## التشغيل

تحتاج Python 3.11 أو أحدث:

```bash
python -m unittest discover -s tests -v
python -m nextgpt.cli doctor
python -m nextgpt.cli scaffold my-agent --output ./generated
python -m nextgpt.cli eval examples/eval_cases.json
```

تتضمن النسخة أداة إنشاء هيكل وكيل، وفحص مواصفات الوكلاء، واختبارات تقييم JSON، وذاكرة مشروع محلية، وإرشادات الأمان وGitHub Actions.

**تنبيه:** لا تضع مفاتيح API أو كلمات المرور في المستودع. التكاملات الخارجية موثقة لكنها تحتاج إعدادًا منفصلًا.
