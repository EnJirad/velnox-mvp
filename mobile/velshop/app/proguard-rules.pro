# Add project specific ProGuard rules here.
-keep class com.velnox.velshop.data.model.** { *; }
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
