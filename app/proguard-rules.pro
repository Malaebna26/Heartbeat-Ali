# التطبيق لا يستعمل مكتبات تعتمد على الانعكاس.
# جسور JavaScript: يجب ألا تُعاد تسمية دوالها ولا تُحذف، وإلا تتعطل الطباعة والتفعيل في نسخة release.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
