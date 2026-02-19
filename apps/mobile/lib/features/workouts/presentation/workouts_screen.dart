import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../shared/sport_constants.dart';
import '../../../shared/widgets/glass_card.dart';
import '../data/models/workout.dart';
import '../providers/workouts_provider.dart';

class WorkoutsScreen extends ConsumerWidget {
  const WorkoutsScreen({super.key});

  static const _filters = ['ALL', 'RUN', 'BIKE', 'SWIM', 'STRENGTH'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final activeFilter = ref.watch(workoutFilterProvider);
    final asyncWorkouts = ref.watch(filteredWorkoutsProvider);

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(filteredWorkoutsProvider);
            ref.invalidate(allWorkoutsProvider);
          },
          child: CustomScrollView(
            slivers: [
              // ── Header ──
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                sliver: SliverToBoxAdapter(
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Workouts',
                          style: theme.textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      IconButton.filled(
                        onPressed: () {
                          // TODO: Add workout form
                        },
                        icon: const Icon(LucideIcons.plus, size: 20),
                        style: IconButton.styleFrom(
                          backgroundColor: theme.colorScheme.primary,
                          foregroundColor: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // ── Filter chips ──
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                sliver: SliverToBoxAdapter(
                  child: Wrap(
                    spacing: 8,
                    children: _filters.map((filter) {
                      final selected = activeFilter == filter;
                      return FilterChip(
                        label: Text(sportLabel(filter)),
                        selected: selected,
                        onSelected: (_) {
                          ref.read(workoutFilterProvider.notifier).set(
                              filter);
                        },
                        avatar: selected
                            ? null
                            : Icon(sportIcon(filter), size: 16),
                        selectedColor:
                            sportColor(filter).withValues(alpha: 0.2),
                        checkmarkColor: sportColor(filter),
                        labelStyle: TextStyle(
                          color: selected
                              ? sportColor(filter)
                              : theme.colorScheme.onSurface
                                  .withValues(alpha: 0.7),
                          fontWeight:
                              selected ? FontWeight.w600 : FontWeight.w400,
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ),

              // ── Workout list ──
              asyncWorkouts.when(
                loading: () => const SliverPadding(
                  padding: EdgeInsets.all(40),
                  sliver: SliverToBoxAdapter(
                    child: Center(child: CircularProgressIndicator()),
                  ),
                ),
                error: (error, _) => SliverPadding(
                  padding: const EdgeInsets.all(20),
                  sliver: SliverToBoxAdapter(
                    child: GlassCard(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            Icon(LucideIcons.alertTriangle,
                                color: theme.colorScheme.error),
                            const SizedBox(width: 12),
                            Expanded(
                                child:
                                    Text('Failed to load workouts: $error')),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                data: (workouts) {
                  if (workouts.isEmpty) {
                    return SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              LucideIcons.dumbbell,
                              size: 48,
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.2),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              activeFilter == 'ALL'
                                  ? 'No workouts yet'
                                  : 'No ${sportLabel(activeFilter).toLowerCase()} workouts',
                              style: theme.textTheme.titleMedium?.copyWith(
                                color: theme.colorScheme.onSurface
                                    .withValues(alpha: 0.5),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Tap + to log your first workout',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurface
                                    .withValues(alpha: 0.4),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }

                  return SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    sliver: SliverList.separated(
                      itemCount: workouts.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        return _WorkoutCard(
                          workout: workouts[index],
                          theme: theme,
                        );
                      },
                    ),
                  );
                },
              ),

              // Bottom padding
              const SliverPadding(padding: EdgeInsets.only(bottom: 24)),
            ],
          ),
        ),
      ),
    );
  }

}

// ── Workout Card ─────────────────────────────────────────

class _WorkoutCard extends StatelessWidget {
  const _WorkoutCard({required this.workout, required this.theme});

  final Workout workout;
  final ThemeData theme;

  IconData get _icon {
    switch (workout.activityType) {
      case 'SWIM':
        return LucideIcons.waves;
      case 'BIKE':
        return LucideIcons.bike;
      case 'RUN':
        return LucideIcons.footprints;
      case 'STRENGTH':
        return LucideIcons.dumbbell;
      case 'YOGA':
        return LucideIcons.flower;
      default:
        return LucideIcons.activity;
    }
  }

  Color get _color {
    switch (workout.activityType) {
      case 'SWIM':
        return const Color(0xFF06B6D4);
      case 'BIKE':
        return const Color(0xFF22C55E);
      case 'RUN':
        return const Color(0xFFF59E0B);
      case 'STRENGTH':
        return const Color(0xFFEF4444);
      default:
        return const Color(0xFF8B5CF6);
    }
  }

  String get _title {
    return workout.activityType[0] +
        workout.activityType.substring(1).toLowerCase();
  }

  String get _formattedDate {
    final now = DateTime.now();
    final diff = now.difference(workout.startedAt);
    if (diff.inDays == 0) return 'Today';
    if (diff.inDays == 1) return 'Yesterday';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    final d = workout.startedAt;
    return '${d.day}/${d.month}/${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top row: sport + date
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: _color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(_icon, size: 20, color: _color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _title,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      '$_formattedDate · ${workout.source}',
                      style: TextStyle(
                        fontSize: 12,
                        color: theme.colorScheme.onSurface
                            .withValues(alpha: 0.45),
                      ),
                    ),
                  ],
                ),
              ),
              if (workout.tss != null)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '${workout.tss} TSS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: _color,
                    ),
                  ),
                ),
            ],
          ),

          const SizedBox(height: 12),

          // Stats row
          Row(
            children: [
              _Metric(
                icon: LucideIcons.clock,
                value: workout.formattedDuration,
              ),
              if (workout.distanceKm != null) ...[
                const SizedBox(width: 16),
                _Metric(
                  icon: LucideIcons.mapPin,
                  value: '${workout.distanceKm} km',
                ),
              ],
              if (workout.avgHr != null) ...[
                const SizedBox(width: 16),
                _Metric(
                  icon: LucideIcons.heart,
                  value: '${workout.avgHr} bpm',
                ),
              ],
              if (workout.avgPowerW != null) ...[
                const SizedBox(width: 16),
                _Metric(
                  icon: LucideIcons.zap,
                  value: '${workout.avgPowerW}W',
                ),
              ],
              if (workout.formattedPace != null &&
                  workout.activityType == 'RUN') ...[
                const SizedBox(width: 16),
                _Metric(
                  icon: LucideIcons.gauge,
                  value: workout.formattedPace!,
                ),
              ],
            ],
          ),

          // Notes
          if (workout.notes != null && workout.notes!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              workout.notes!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 12,
                color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.icon, required this.value});
  final IconData icon;
  final String value;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: color),
        const SizedBox(width: 4),
        Text(
          value,
          style: TextStyle(fontSize: 12, color: color),
        ),
      ],
    );
  }
}
