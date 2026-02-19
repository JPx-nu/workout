import 'dart:ui';
import 'package:flutter/material.dart';
import '../../app/theme/app_theme.dart';

/// Glassmorphism card matching the web app's `glass-card` CSS class.
class GlassCard extends StatelessWidget {
  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.borderRadius,
    this.onTap,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final BorderRadius? borderRadius;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final radius = borderRadius ??
        BorderRadius.circular(GlassTokens.borderRadius);

    return ClipRRect(
      borderRadius: radius,
      child: BackdropFilter(
        filter: ImageFilter.blur(
          sigmaX: GlassTokens.blurSigma,
          sigmaY: GlassTokens.blurSigma,
        ),
        child: Material(
          color: isDark
              ? Colors.white.withValues(alpha: GlassTokens.surfaceOpacity)
              : Colors.white.withValues(alpha: 0.7),
          shape: RoundedRectangleBorder(
            borderRadius: radius,
            side: BorderSide(
              color: Colors.white
                  .withValues(alpha: GlassTokens.borderOpacity),
            ),
          ),
          child: InkWell(
            onTap: onTap,
            borderRadius: radius,
            child: Padding(
              padding: padding,
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}
