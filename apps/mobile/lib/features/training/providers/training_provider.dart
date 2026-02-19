import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../data/models/training_plan.dart';
import '../data/training_repository.dart';

// ── Repository provider ──────────────────────────────────

final _trainingRepoProvider = Provider<TrainingRepository>((ref) {
  return TrainingRepository(ref.watch(supabaseProvider));
});

// ── Active training plan ─────────────────────────────────

/// Fetches the active training plan for the current user.
final trainingPlanProvider = FutureProvider<TrainingPlan>((ref) async {
  final user = ref.read(supabaseProvider).auth.currentUser;
  if (user == null) return TrainingPlan.empty;
  return ref.read(_trainingRepoProvider).fetchActivePlan(user.id);
});

// ── Upcoming events ──────────────────────────────────────

/// Fetches upcoming race/event calendar entries.
final upcomingEventsProvider = FutureProvider<List<UpcomingEvent>>((ref) async {
  return ref.read(_trainingRepoProvider).fetchUpcomingEvents();
});

// ── Session toggle (local UI state) ──────────────────────

/// Manages the local toggle state for "done" checkmarks on sessions.
///
/// Tapping a session toggles its [done] flag client-side (optimistic).
class SessionToggleNotifier extends Notifier<List<TrainingSession>> {
  @override
  List<TrainingSession> build() => [];

  /// Initialise from the fetched plan data.
  void init(List<TrainingSession> sessions) {
    state = List.of(sessions);
  }

  /// Toggle the done state of session at [index].
  void toggle(int index) {
    if (index < 0 || index >= state.length) return;
    state = [
      for (int i = 0; i < state.length; i++)
        if (i == index) state[i].copyWith(done: !state[i].done) else state[i],
    ];
  }
}

final sessionToggleProvider =
    NotifierProvider<SessionToggleNotifier, List<TrainingSession>>(
  SessionToggleNotifier.new,
);
