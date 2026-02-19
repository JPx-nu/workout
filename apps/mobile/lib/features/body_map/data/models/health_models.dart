// Health & body-map data models.
//
// Mirrors web types in `lib/mock/health.ts` and Supabase tables
// `daily_logs`, `injuries`.

enum FatigueLevel { low, moderate, high }

class MuscleFatigue {
  const MuscleFatigue({
    required this.muscle,
    required this.bodyPart,
    required this.level,
    required this.status,
  });

  /// Human label (e.g. "Quadriceps").
  final String muscle;

  /// Snake-case key matching `injuries.body_part` (e.g. "quadriceps").
  final String bodyPart;

  /// Fatigue intensity 0–100.
  final int level;

  final FatigueLevel status;
}

class DailyLog {
  const DailyLog({
    required this.id,
    required this.date,
    required this.sleepHours,
    required this.sleepQuality,
    required this.rpe,
    required this.mood,
    required this.hrv,
    required this.restingHr,
    required this.weightKg,
    this.notes,
  });

  final String id;
  final DateTime date;
  final double sleepHours;
  final int sleepQuality; // 1–10
  final int rpe; // 1–10
  final int mood; // 1–10
  final int hrv;
  final int restingHr;
  final double weightKg;
  final String? notes;

  factory DailyLog.fromRow(Map<String, dynamic> row) {
    return DailyLog(
      id: row['id'] as String,
      date: DateTime.parse(row['log_date'] as String),
      sleepHours: (row['sleep_hours'] as num?)?.toDouble() ?? 0,
      sleepQuality: (row['sleep_quality'] as num?)?.toInt() ?? 5,
      rpe: (row['rpe'] as num?)?.toInt() ?? 5,
      mood: (row['mood'] as num?)?.toInt() ?? 5,
      hrv: (row['hrv'] as num?)?.toInt() ?? 0,
      restingHr: (row['resting_hr'] as num?)?.toInt() ?? 0,
      weightKg: (row['weight_kg'] as num?)?.toDouble() ?? 0,
      notes: row['notes'] as String?,
    );
  }
}

class HealthSnapshot {
  const HealthSnapshot({
    required this.hrv,
    required this.restingHr,
    required this.sleepHours,
    required this.sleepQuality,
    required this.vo2max,
    required this.weightKg,
    required this.readinessScore,
  });

  final int hrv;
  final int restingHr;
  final double sleepHours;
  final int sleepQuality;
  final double vo2max;
  final double weightKg;
  final int readinessScore;

  static const empty = HealthSnapshot(
    hrv: 0,
    restingHr: 0,
    sleepHours: 0,
    sleepQuality: 0,
    vo2max: 0,
    weightKg: 0,
    readinessScore: 0,
  );
}

/// Default muscle groups — always rendered, even with no active injuries.
const defaultMuscleGroups = <MuscleFatigue>[
  MuscleFatigue(muscle: 'Quadriceps', bodyPart: 'quadriceps', level: 0, status: FatigueLevel.low),
  MuscleFatigue(muscle: 'Hamstrings', bodyPart: 'hamstrings', level: 0, status: FatigueLevel.low),
  MuscleFatigue(muscle: 'Calves', bodyPart: 'calves', level: 0, status: FatigueLevel.low),
  MuscleFatigue(muscle: 'Shoulders', bodyPart: 'shoulders', level: 0, status: FatigueLevel.low),
  MuscleFatigue(muscle: 'Core', bodyPart: 'core', level: 0, status: FatigueLevel.low),
  MuscleFatigue(muscle: 'Glutes', bodyPart: 'glutes', level: 0, status: FatigueLevel.low),
  MuscleFatigue(muscle: 'Lower Back', bodyPart: 'lower_back', level: 0, status: FatigueLevel.low),
  MuscleFatigue(muscle: 'Lats', bodyPart: 'lats', level: 0, status: FatigueLevel.low),
  MuscleFatigue(muscle: 'Chest', bodyPart: 'chest', level: 0, status: FatigueLevel.low),
  MuscleFatigue(muscle: 'Biceps', bodyPart: 'biceps', level: 0, status: FatigueLevel.low),
  MuscleFatigue(muscle: 'Triceps', bodyPart: 'triceps', level: 0, status: FatigueLevel.low),
  MuscleFatigue(muscle: 'Traps', bodyPart: 'traps', level: 0, status: FatigueLevel.low),
  MuscleFatigue(muscle: 'Forearms', bodyPart: 'forearms', level: 0, status: FatigueLevel.low),
  MuscleFatigue(muscle: 'Neck', bodyPart: 'neck', level: 0, status: FatigueLevel.low),
  MuscleFatigue(muscle: 'Hip Flexors', bodyPart: 'hip_flexors', level: 0, status: FatigueLevel.low),
  MuscleFatigue(muscle: 'Adductors', bodyPart: 'adductors', level: 0, status: FatigueLevel.low),
];
