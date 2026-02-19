// ============================================================
// Training Plan data models — mirrors web's lib/mock/training.ts
// ============================================================

/// A single day's training session within a weekly plan.
class TrainingSession {
  const TrainingSession({
    required this.day,
    required this.session,
    required this.type,
    required this.done,
    this.durationMin,
  });

  final String day;
  final String session;
  final String type; // SWIM, BIKE, RUN, STRENGTH
  final bool done;
  final int? durationMin;

  factory TrainingSession.fromJson(Map<String, dynamic> json) {
    return TrainingSession(
      day: json['day'] as String? ?? '',
      session: json['session'] as String? ?? '',
      type: (json['type'] as String? ?? 'RUN').toUpperCase(),
      done: json['done'] as bool? ?? false,
      durationMin: json['durationMin'] as int?,
    );
  }

  Map<String, dynamic> toJson() => {
        'day': day,
        'session': session,
        'type': type,
        'done': done,
        if (durationMin != null) 'durationMin': durationMin,
      };

  TrainingSession copyWith({bool? done}) => TrainingSession(
        day: day,
        session: session,
        type: type,
        done: done ?? this.done,
        durationMin: durationMin,
      );
}

/// The active training plan for the current user.
class TrainingPlan {
  const TrainingPlan({
    required this.id,
    required this.name,
    required this.eventDate,
    required this.eventName,
    required this.currentWeek,
    required this.totalWeeks,
    required this.status,
    required this.thisWeek,
  });

  final String id;
  final String name;
  final String eventDate;
  final String eventName;
  final int currentWeek;
  final int totalWeeks;
  final String status; // draft, active, completed, archived
  final List<TrainingSession> thisWeek;

  /// Empty plan used as default/fallback.
  static const empty = TrainingPlan(
    id: '',
    name: '',
    eventDate: '',
    eventName: '',
    currentWeek: 0,
    totalWeeks: 0,
    status: 'draft',
    thisWeek: [],
  );

  bool get isEmpty => id.isEmpty;

  /// Progress through the multi-week plan as a percentage (0-100).
  int get progressPercent =>
      totalWeeks > 0 ? ((currentWeek / totalWeeks) * 100).round() : 0;

  /// Number of days until the target event.
  int get daysUntilEvent {
    if (eventDate.isEmpty) return 0;
    final target = DateTime.tryParse(eventDate);
    if (target == null) return 0;
    final diff = target.difference(DateTime.now()).inDays;
    return diff < 0 ? 0 : diff;
  }

  /// Count of completed sessions this week.
  int get completedCount => thisWeek.where((s) => s.done).length;

  factory TrainingPlan.fromSupabase(Map<String, dynamic> row) {
    final planData = row['plan_data'] as Map<String, dynamic>? ?? {};
    final weekList = planData['thisWeek'] as List<dynamic>? ?? [];

    return TrainingPlan(
      id: row['id'] as String? ?? '',
      name: row['name'] as String? ?? '',
      eventDate: row['event_date'] as String? ?? '',
      eventName: row['event_name'] as String? ?? '',
      currentWeek: (planData['currentWeek'] as num?)?.toInt() ??
          (row['current_week'] as num?)?.toInt() ??
          0,
      totalWeeks: (planData['totalWeeks'] as num?)?.toInt() ??
          (row['total_weeks'] as num?)?.toInt() ??
          0,
      status: row['status'] as String? ?? 'active',
      thisWeek: weekList
          .map((e) => TrainingSession.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

/// An upcoming race or training event.
class UpcomingEvent {
  const UpcomingEvent({
    required this.id,
    required this.name,
    required this.date,
    required this.type,
    required this.location,
  });

  final String id;
  final String name;
  final String date;
  final String type; // SPRINT, OLYMPIC, HALF_IRONMAN, IRONMAN, CUSTOM
  final String location;

  /// Number of days until this event.
  int get daysUntil {
    final target = DateTime.tryParse(date);
    if (target == null) return 0;
    final diff = target.difference(DateTime.now()).inDays;
    return diff < 0 ? 0 : diff;
  }

  factory UpcomingEvent.fromSupabase(Map<String, dynamic> row) {
    return UpcomingEvent(
      id: row['id'] as String? ?? '',
      name: row['name'] as String? ?? '',
      date: row['event_date'] as String? ?? '',
      type: row['event_type'] as String? ?? 'race',
      location: row['location'] as String? ?? '',
    );
  }
}
