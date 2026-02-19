import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/workout.dart';
import '../data/workout_repository.dart';

// ── Filter state ──────────────────────────────────────────

/// Notifier for the active filter chip on the workouts screen.
class WorkoutFilterNotifier extends Notifier<String> {
  @override
  String build() => 'ALL';

  void set(String filter) => state = filter;
}

/// The active filter chip on the workouts screen.
final workoutFilterProvider =
    NotifierProvider<WorkoutFilterNotifier, String>(WorkoutFilterNotifier.new);

// ── All workouts (unfiltered, for dashboard use too) ──────

/// Fetches all workouts for the current user.
///
/// Other providers (dashboard stats, chart data) derive from this.
final allWorkoutsProvider = FutureProvider<List<Workout>>((ref) async {
  final repo = ref.watch(workoutRepositoryProvider);
  return repo.fetchWorkouts();
});

// ── Filtered workouts (for the workouts list screen) ──────

/// Workouts filtered by the active [workoutFilterProvider].
final filteredWorkoutsProvider = FutureProvider<List<Workout>>((ref) async {
  final filter = ref.watch(workoutFilterProvider);
  final repo = ref.watch(workoutRepositoryProvider);
  return repo.fetchWorkouts(activityType: filter);
});

// ── Dashboard providers ───────────────────────────────────

/// Weekly stats computed from all workouts.
final weeklyStatsProvider = Provider<WeeklyStats>((ref) {
  final asyncWorkouts = ref.watch(allWorkoutsProvider);
  return asyncWorkouts.when(
    data: (workouts) {
      final repo = ref.read(workoutRepositoryProvider);
      return repo.computeWeeklyStats(workouts);
    },
    loading: () => WeeklyStats.empty,
    error: (_, _) => WeeklyStats.empty,
  );
});

/// Chart data for the weekly stacked bar chart.
final chartDataProvider = Provider<List<ChartDataPoint>>((ref) {
  final asyncWorkouts = ref.watch(allWorkoutsProvider);
  return asyncWorkouts.when(
    data: (workouts) {
      final repo = ref.read(workoutRepositoryProvider);
      return repo.computeChartData(workouts);
    },
    loading: () => [],
    error: (_, _) => [],
  );
});
