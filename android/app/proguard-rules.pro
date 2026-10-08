# org.json and ZXing are used without reflection; the AndroidX libraries ship their own rules.
-keep class com.shahinst.cdnscanner.** { *; }
-dontwarn org.bouncycastle.**
