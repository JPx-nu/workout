import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

/// Unified sport type constants used across Dashboard, Workouts, and Training.
///
/// Centralised here to guarantee colour and icon consistency throughout the app.

// ── Colours ──────────────────────────────────────────────────

const sportSwimColor = Color(0xFF06B6D4);
const sportBikeColor = Color(0xFF22C55E);
const sportRunColor = Color(0xFFF59E0B);
const sportStrengthColor = Color(0xFFEF4444);
const sportDefaultColor = Color(0xFF8B5CF6);

const sportTypeColors = <String, Color>{
  'SWIM': sportSwimColor,
  'BIKE': sportBikeColor,
  'RUN': sportRunColor,
  'STRENGTH': sportStrengthColor,
};

// ── Icons ────────────────────────────────────────────────────

const sportTypeIcons = <String, IconData>{
  'SWIM': LucideIcons.waves,
  'BIKE': LucideIcons.bike,
  'RUN': LucideIcons.footprints,
  'STRENGTH': LucideIcons.dumbbell,
  'YOGA': LucideIcons.flower,
};

// ── Helper functions (for switch defaults) ───────────────────

/// Returns the sport colour for [type], falling back to purple.
Color sportColor(String type) => sportTypeColors[type] ?? sportDefaultColor;

/// Returns the sport icon for [type], falling back to an activity icon.
IconData sportIcon(String type) => sportTypeIcons[type] ?? LucideIcons.activity;

/// Friendly display label for a sport type key.
String sportLabel(String type) {
  return switch (type) {
    'ALL' => 'All',
    'RUN' => 'Run',
    'BIKE' => 'Bike',
    'SWIM' => 'Swim',
    'STRENGTH' => 'Strength',
    'YOGA' => 'Yoga',
    _ => type,
  };
}
