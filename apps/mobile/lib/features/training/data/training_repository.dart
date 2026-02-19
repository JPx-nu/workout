import 'package:supabase_flutter/supabase_flutter.dart';
import 'models/training_plan.dart';

/// Repository that fetches training plan and event data from Supabase.
///
/// Mirrors the logic in the web's `use-training.ts` hook:
///   1. Fetch the single active training plan for the user.
///   2. Fetch upcoming events ordered by date.
class TrainingRepository {
  TrainingRepository(this._supabase);

  final SupabaseClient _supabase;

  /// Fetch the active training plan for [userId].
  ///
  /// Returns [TrainingPlan.empty] if the user has no active plan.
  Future<TrainingPlan> fetchActivePlan(String userId) async {
    final data = await _supabase
        .from('training_plans')
        .select()
        .eq('athlete_id', userId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

    if (data == null) return TrainingPlan.empty;
    return TrainingPlan.fromSupabase(data);
  }

  /// Fetch upcoming events (from today onwards, max 10).
  Future<List<UpcomingEvent>> fetchUpcomingEvents() async {
    final today = DateTime.now().toIso8601String().split('T')[0];

    final data = await _supabase
        .from('events')
        .select()
        .gte('event_date', today)
        .order('event_date', ascending: true)
        .limit(10);

    return (data as List<dynamic>)
        .map((e) => UpcomingEvent.fromSupabase(e as Map<String, dynamic>))
        .toList();
  }
}
