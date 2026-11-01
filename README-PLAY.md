# نبضات ربيع - دليل البناء والنشر على Google Play

## 1. الحالة الحالية (بصراحة)
- المشروع كامل: إعدادات Gradle، ومعلومات التطبيق، وكود `MainActivity.kt`، وصفحة الفحص داخل `app/src/main/assets/app/index.html`.
- **لم يُبنَ ولم يُختبر على جهاز بعد.** بيئة الإنشاء التي عملت فيها لا تحتوي Android SDK ولا تصل إلى مستودعات Google، لذلك لم أستطع إنتاج ملف AAB هنا. أول خطوة عندك هي فتح المشروع في Android Studio وبناؤه، ثم اختباره على هاتف حقيقي.
- التطبيق **لا يطلب أي صلاحية** (لا يوجد INTERNET في المانيفست)، فهو مناسب للعمل دون إنترنت ولسياسة "Data safety" البسيطة.

## 2. ما تحتاجه قبل النشر
| البند | ملاحظات |
|---|---|
| حساب Google Play Console | رسوم تسجيل لمرة واحدة (25 دولاراً). يشترط Google التحقق من الهوية. |
| معرّف تطبيق فريد `applicationId` | تم ضبطه على `dz.alidz.nabadatrabie`. لا يُغيَّر بعد أول رفع على Play |
| مفتاح التوقيع (keystore) | أنشئه مرة واحدة واحتفظ به ونسخة احتياطية منه؛ فقدانه يمنعك من التحديث. |
| رابط سياسة خصوصية عام | يجب أن يكون متاحاً على الإنترنت بعنوان URL. ملف `privacy.html` جاهز، وارفعه على موقع أو GitHub Pages. |
| بريد دعم | يظهر للمستخدمين في صفحة المتجر. |

## 2ب. البناء عبر GitHub (بدون Android Studio)
1. ارفع المجلد إلى مستودع GitHub خاص (private). ملف `.github/workflows/android.yml` يبني المشروع تلقائياً عند كل رفع.
2. من تبويب **Actions** تجد نتيجة البناء، ومن **Artifacts** تنزّل:
   - `app/build/outputs/apk/play/debug/*.apk` للتجربة على الهاتف.
   - `app/build/outputs/bundle/playRelease/*.aab` للرفع على Play Console.
3. يتحقق الملف تلقائياً من: سلامة JavaScript للصفحة، وعدم وجود روابط خارجية، وعدم وجود صلاحية INTERNET.
4. لتوقيع AAB للنشر، أضف في **Settings > Secrets and variables > Actions** الأسرار التالية (لا ترسل المفتاح في أي محادثة):
   - `KEYSTORE_BASE64`: محتوى ملف `.jks` بصيغة base64 (`base64 -w0 release-key.jks`)
   - `STORE_PASSWORD`، `KEY_ALIAS`، `KEY_PASSWORD`
   بدون هذه الأسرار يُبنى AAB غير موقّع، ولا يقبله Play.

## 3. إنشاء مفتاح التوقيع
```bash
keytool -genkeypair -v -keystore release-key.jks -alias nabadat-release -keyalg RSA -keysize 2048 -validity 10000
```
ثم انسخ `keystore.properties.example` إلى `keystore.properties` وأدخل كلمات المرور. **لا ترفع `.jks` ولا `keystore.properties` إلى أي مستودع** (مذكورة في `.gitignore`).

## 4. بناء ملف AAB للنشر
1. افتح المجلد في **Android Studio** (الإصدار الحديث). سيُنشئ Gradle Wrapper تلقائياً.
2. Build > Generate Signed App Bundle / APK > Android App Bundle > اختر المفتاح > release.
3. الناتج: `app/build/outputs/bundle/playRelease/app-play-release.aab`.

قبل رفع الملف تحقق من:
- **Merged Manifest** يجب ألا يحتوي `android.permission.INTERNET`.
- التطبيق يعمل في وضع الطيران (Airplane mode) مع رفع ملف القائمة وحفظ القياسات.
- زر الرجوع يعمل بشكل صحيح، وتظهر الصفحة كاملة دون تداخل مع أشرطة النظام.
- `versionCode` أكبر من أي إصدار سابق (يبدأ من 1).

## 5. متطلبات Google Play (حسب الصفحة الرسمية وقت كتابة هذا الدليل)
- **targetSdk 36 (Android 16):** إلزامي للتطبيقات الجديدة والتحديثات منذ 31 أغسطس 2026. المشروع مضبوط على 36. تحقق من المرجع الرسمي قبل النشر: https://developer.android.com/google/play/requirements/target-sdk
- **Play App Signing:** فعّله عند أول رفع، وسيحتفظ Google بمفتاح التوقيع النهائي، وتحتفظ أنت بمفتاح الرفع (upload key).
- **اختبار مغلق قبل الإنتاج:** الحسابات الشخصية الجديدة تحتاج عادةً إلى 12 مختبراً على الأقل لمدة 14 يوماً متتالياً قبل إتاحة الإنتاج. تحقق من الشرط الحالي في Play Console لحسابك.
- **الصفحات المطلوبة في Play Console** (قسم "محتوى التطبيق" و"Dashboard"):

| القسم | الإجابة المقترحة |
|---|---|
| سياسة الخصوصية | رابط `privacy.html` المنشور |
| الوصول إلى التطبيق | متاح بالكامل دون تسجيل دخول |
| الإعلانات | لا يحتوي إعلانات |
| تصنيف المحتوى (IARC) | أجب بدقة، لا عنف ولا محتوى مستخدمين. التصنيف المتوقع للجميع |
| الجمهور المستهدف | **18 سنة فأكثر** (المستعمل معلمون)، ولا تختر فئات الأطفال، لأن ذلك يفرض قواعد أشد على التطبيق |
| أمان البيانات (Data safety) | لا توجد بيانات تُجمع أو تُشارك. كل شيء يبقى على الجهاز. لأن Google يعتبر البيانات "مجمّعة" فقط إذا أُرسلت خارج الجهاز |
| إعلان التطبيقات الصحية | التطبيق أداة فرز وتعليم، وليس تشخيصاً طبياً ولا جهازاً طبياً. وضّح ذلك في الوصف |
| الفئة | تعليم (Education) بدلاً من الصحة، لتفادي مراجعة أشد |
| تكوين المتجر | أيقونة 512×512 (في `store/icon-512.png`)، وصورة مميزة 1024×500 (في `store/feature-1024x500.png`)، ولقطات شاشة هاتف (لا تقل عن 2). التقط اللقطات من هاتف حقيقي باستخدام قائمة تجريبية، ولا تستعمل أسماء تلاميذ حقيقيين |

## 6. نص مقترح لصفحة المتجر
**العنوان:** نبضات ربيع (لا يتجاوز 30 حرفاً)

**وصف قصير (لا يتجاوز 80 حرفاً):**
أداة فرز أولي لنبضات التلاميذ للمعلمين، تعمل دون إنترنت.

**وصف كامل (العربية):**
نبضات ربيع أداة مساعدة للمعلمين لتسجيل نبض التلاميذ قبل النشاط وبعده، وإجراء فرز أولي للنتائج.
- استيراد قوائم التلاميذ من ملف Excel أو CSV، مع فصل كل قسم عن الآخر.
- إدخال القياسات في الجدول ونتيجة فورية لكل تلميذ.
- عداد دقيقة مدمج بتنبيه صوتي واهتزاز.
- سجل لكل تلميذ مع رسوم بيانية لتطور النبض والتعافي عبر الجلسات.
- تقرير للقسم يمكن حفظه PDF، وتصدير النتائج CSV.
- نسخ احتياطي واستعادة من ملف.
- فحص فردي لشخص واحد دون قائمة.
- واجهة بالعربية والفرنسية، ووضع نهاري وليلي.
- يعمل بالكامل دون إنترنت، ولا يرسل أي بيانات، وكل ما تُدخله يبقى على جهازك.

تنبيه: التطبيق ليس جهازاً طبياً ولا يشخّص ولا يعالج ولا يمنع أي حالة طبية. هو أداة فرز أولي فقط. استشر دائماً طبيباً أو مختصاً صحياً للتشخيص أو العلاج أو أي نصيحة طبية، ولا تعتمد على نتائج التطبيق وحدها.
This app is not a medical device and does not diagnose, treat, cure, or prevent any medical condition. Always consult a healthcare professional for medical advice.

**Description courte (80 caractères max) :**
Tri préliminaire du pouls des élèves pour enseignants, sans Internet.

**Description complète (Français) :**
Nabadat Rabie aide les enseignants à noter le pouls des élèves avant et après l'effort et à faire un premier tri des résultats.
- Import des listes d'élèves depuis Excel ou CSV, chaque classe séparée.
- Saisie des mesures dans un tableau avec résultat immédiat.
- Minuterie d'une minute avec alerte sonore et vibration.
- Historique par élève avec graphiques d'évolution du pouls et de la récupération.
- Rapport de classe enregistrable en PDF, export CSV.
- Sauvegarde et restauration depuis un fichier.
- Test individuel pour une seule personne.
- Interface en arabe et en français, mode clair et sombre.
- Fonctionne entièrement hors ligne : aucune donnée n'est envoyée, tout reste sur votre appareil.

Avertissement : cette application n'est pas un dispositif médical et ne diagnostique, ne traite, ne guérit ni ne prévient aucune maladie. Consultez toujours un professionnel de santé pour un avis médical.

**لقطات الشاشة:** جاهزة في `store/screenshots/` (6 لقطات 1080×1920 بأسماء تلاميذ وهمية). أيقونة المتجر `store/icon-512.png` بصيغة PNG 32 بت مع قناة شفافية، وصورة الغلاف `store/feature-1024x500.png`.

## 7. نص سياسة الخصوصية (مختصر)
التطبيق يعمل على جهاز المستخدم فقط دون اتصال بالإنترنت، ولا يرسل أي بيانات إلى أي خادم، ولا يستعمل أدوات تتبع أو إعلانات. البيانات التي يُدخلها المستخدم (أسماء، تواريخ ميلاد، قياسات) تُحفظ محلياً على الجهاز ويمكن حذفها من التطبيق. للتواصل: algeriancitizen14@gmail.com.

## 8. تنبيهات قانونية مهمة
- التطبيق يعالج بيانات **قاصرين** (أسماء وتواريخ ميلاد وقياسات). في الجزائر ينظم القانون 18-07 المتعلق بحماية الأشخاص الطبيعيين في معالجة المعطيات ذات الطابع الشخصي هذا النوع من المعالجة. تحقق من متطلباتك مع مختص قبل النشر أو الاستعمال في مؤسسة.
- التطبيق لا يحفظ بيانات على خوادم، لكن المعلم مسؤول عن الجهاز وعن ملف CSV الذي يصدّره.
- العتبات المستعملة (نبض الراحة والتعافي) تقديرية، ويجب أن يعتمدها طبيب مختص قبل أي استعمال رسمي.

## ملاحظة: النسختان (play / direct) والتفعيل

- **play**: للنشر على Google Play. كل الميزات مفتوحة، ولا توجد شاشة تفعيل. الأمر: `gradle :app:bundlePlayRelease`.
- **direct**: للتوزيع المباشر خارج Play، وتصدير CSV وPDF والنسخ الاحتياطي مقفلة حتى إدخال كود تفعيل. الأمر: `gradle :app:assembleDirectRelease`.
- توليد كود: من GitHub ← Actions ← «توليد كود تفعيل» (يحتاج السر `LICENSE_PRIVATE_KEY`). المفتاح الخاص لا يُرفع إلى المستودع أبداً.
