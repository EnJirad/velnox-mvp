package com.velnox.velshop.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// ─── Velnox brand palette ────────────────────────────────────────────────────

val LimeGreen = Color(0xFFB4FF39)       // Primary / accent
val LimeGreenDark = Color(0xFF8BCC1A)
val LimeGreenLight = Color(0xFFD4FF7A)

val DarkBackground = Color(0xFF0D0D0D)
val DarkSurface = Color(0xFF1A1A1A)
val DarkSurfaceVariant = Color(0xFF2A2A2A)
val DarkCard = Color(0xFF151515)

val TextPrimary = Color(0xFFF5F5F5)
val TextSecondary = Color(0xFFB0B0B0)
val TextMuted = Color(0xFF707070)

val ErrorRed = Color(0xFFFF5252)
val WarningOrange = Color(0xFFFFB74D)
val SuccessGreen = Color(0xFF81C784)

private val VelShopDarkColorScheme = darkColorScheme(
    primary = LimeGreen,
    onPrimary = DarkBackground,
    primaryContainer = LimeGreenDark,
    onPrimaryContainer = DarkBackground,
    secondary = Color(0xFF90CAF9),
    onSecondary = DarkBackground,
    tertiary = Color(0xFFCE93D8),
    onTertiary = DarkBackground,
    background = DarkBackground,
    onBackground = TextPrimary,
    surface = DarkSurface,
    onSurface = TextPrimary,
    surfaceVariant = DarkSurfaceVariant,
    onSurfaceVariant = TextSecondary,
    error = ErrorRed,
    onError = Color.White,
    outline = Color(0xFF444444),
)

private val VelShopLightColorScheme = lightColorScheme(
    primary = Color(0xFF5A8C00),
    onPrimary = Color.White,
    primaryContainer = LimeGreenLight,
    onPrimaryContainer = DarkBackground,
    background = Color(0xFFF8F8F8),
    onBackground = Color(0xFF1A1A1A),
    surface = Color.White,
    onSurface = Color(0xFF1A1A1A),
    surfaceVariant = Color(0xFFE8E8E8),
    onSurfaceVariant = Color(0xFF666666),
    error = ErrorRed,
    onError = Color.White,
    outline = Color(0xFFCCCCCC),
)

@Composable
fun VelShopTheme(
    darkTheme: Boolean = true, // default dark like VelShop web
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) VelShopDarkColorScheme else VelShopLightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = DarkBackground.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = VelShopTypography,
        shapes = VelShopShapes,
        content = content,
    )
}
