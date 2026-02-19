import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../../shared/widgets/glass_card.dart';
import '../data/models/health_models.dart';
import '../providers/health_provider.dart';

class BodyMapScreen extends ConsumerStatefulWidget {
  const BodyMapScreen({super.key});

  @override
  ConsumerState<BodyMapScreen> createState() => _BodyMapScreenState();
}

class _BodyMapScreenState extends ConsumerState<BodyMapScreen> {
  bool _showFront = true;
  String? _selectedBodyPart;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final healthAsync = ref.watch(healthProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Body Map'),
        centerTitle: false,
      ),
      body: healthAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(LucideIcons.alertTriangle,
                  size: 40, color: theme.colorScheme.error),
              const SizedBox(height: 12),
              Text('Failed to load health data',
                  style: TextStyle(color: theme.colorScheme.error)),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: () => ref.invalidate(healthProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (health) => _buildContent(context, health),
      ),
    );
  }

  Widget _buildContent(BuildContext context, HealthState health) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Health summary cards
        _HealthCardsRow(snapshot: health.snapshot),
        const SizedBox(height: 20),

        // Body map
        GlassCard(
          child: Column(
            children: [
              // Front / Back toggle
              _SideToggle(
                showFront: _showFront,
                onChanged: (front) {
                  setState(() {
                    _showFront = front;
                    _selectedBodyPart = null;
                  });
                },
              ),
              const SizedBox(height: 16),

              // Interactive body
              SizedBox(
                height: 400,
                child: GestureDetector(
                  onTapUp: (details) =>
                      _handleBodyTap(details, health.fatigueData),
                  child: CustomPaint(
                    size: const Size(200, 400),
                    painter: _BodyPainter(
                      fatigueData: health.fatigueData,
                      showFront: _showFront,
                      selectedBodyPart: _selectedBodyPart,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // Legend
              const _FatigueLegend(),
            ],
          ),
        ),

        // Selected muscle detail
        if (_selectedBodyPart != null) ...[
          const SizedBox(height: 16),
          _MuscleDetailCard(
            bodyPart: _selectedBodyPart!,
            fatigueData: health.fatigueData,
          ),
        ],

        const SizedBox(height: 20),

        // Daily wellness log
        _DailyLogTable(logs: health.dailyLogs),
      ],
    );
  }

  void _handleBodyTap(TapUpDetails details, List<MuscleFatigue> fatigueData) {
    final box = context.findRenderObject() as RenderBox?;
    if (box == null) return;

    // Map tap position to body part using simple region-based hit testing
    // The CustomPaint is 200×400 logical, centered in its container
    final localPos = details.localPosition;
    final bodyPart = _hitTestBodyPart(localPos, _showFront);

    if (bodyPart != null) {
      setState(() {
        _selectedBodyPart =
            _selectedBodyPart == bodyPart ? null : bodyPart;
      });
    }
  }

  /// Simple region-based hit test mapping tap coordinates to body parts.
  /// Based on a 200×400 body silhouette.
  static String? _hitTestBodyPart(Offset pos, bool front) {
    final x = pos.dx;
    final y = pos.dy;

    // Head region
    if (y < 50 && x > 80 && x < 120) return 'neck';

    // Shoulders
    if (y >= 50 && y < 90) {
      if (x < 70) return 'shoulders';
      if (x > 130) return 'shoulders';
    }

    // Chest / Upper back
    if (y >= 70 && y < 130 && x > 65 && x < 135) {
      return front ? 'chest' : 'traps';
    }

    // Arms
    if (y >= 80 && y < 160) {
      if (x < 60) return front ? 'biceps' : 'triceps';
      if (x > 140) return front ? 'biceps' : 'triceps';
    }

    // Forearms
    if (y >= 160 && y < 220) {
      if (x < 55 || x > 145) return 'forearms';
    }

    // Core / Lower back
    if (y >= 130 && y < 190 && x > 70 && x < 130) {
      return front ? 'core' : 'lower_back';
    }

    // Hip flexors / Glutes
    if (y >= 190 && y < 220 && x > 65 && x < 135) {
      return front ? 'hip_flexors' : 'glutes';
    }

    // Adductors (inner thigh)
    if (y >= 220 && y < 300 && x > 85 && x < 115) return 'adductors';

    // Quadriceps / Hamstrings
    if (y >= 220 && y < 310) {
      if (x >= 60 && x <= 140) {
        return front ? 'quadriceps' : 'hamstrings';
      }
    }

    // Calves
    if (y >= 310 && y < 380 && x >= 65 && x <= 135) return 'calves';

    // Lats (side of torso)
    if (y >= 100 && y < 170) {
      if ((x >= 55 && x <= 70) || (x >= 130 && x <= 145)) {
        return front ? 'chest' : 'lats';
      }
    }

    return null;
  }
}

// ── Health Summary Cards ──────────────────────────────────

class _HealthCardsRow extends StatelessWidget {
  const _HealthCardsRow({required this.snapshot});
  final HealthSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cards = [
      (
        label: 'HRV',
        value: '${snapshot.hrv}ms',
        icon: LucideIcons.heart,
        color: theme.colorScheme.primary,
      ),
      (
        label: 'Resting HR',
        value: '${snapshot.restingHr} bpm',
        icon: LucideIcons.activity,
        color: theme.colorScheme.error,
      ),
      (
        label: 'Sleep',
        value: '${snapshot.sleepHours.toStringAsFixed(1)}h',
        icon: LucideIcons.moon,
        color: Colors.blueAccent,
      ),
      (
        label: 'Readiness',
        value: '${snapshot.readinessScore}',
        icon: LucideIcons.zap,
        color: Colors.amber,
      ),
    ];

    return Row(
      children: cards
          .map((c) => Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: GlassCard(
                    child: Column(
                      children: [
                        Icon(c.icon, size: 18, color: c.color),
                        const SizedBox(height: 6),
                        Text(
                          c.value,
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          c.label,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurface
                                .withValues(alpha: 0.5),
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ))
          .toList(),
    );
  }
}

// ── Front / Back Toggle ───────────────────────────────────

class _SideToggle extends StatelessWidget {
  const _SideToggle({required this.showFront, required this.onChanged});
  final bool showFront;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(24),
      ),
      padding: const EdgeInsets.all(3),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _toggleButton(context, 'Front', showFront, () => onChanged(true)),
          _toggleButton(context, 'Back', !showFront, () => onChanged(false)),
        ],
      ),
    );
  }

  Widget _toggleButton(
      BuildContext context, String label, bool active, VoidCallback onTap) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
        decoration: BoxDecoration(
          color: active ? theme.colorScheme.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: active ? Colors.white : theme.colorScheme.onSurface.withValues(alpha: 0.5),
          ),
        ),
      ),
    );
  }
}

// ── Body Painter ──────────────────────────────────────────

class _BodyPainter extends CustomPainter {
  _BodyPainter({
    required this.fatigueData,
    required this.showFront,
    this.selectedBodyPart,
  });

  final List<MuscleFatigue> fatigueData;
  final bool showFront;
  final String? selectedBodyPart;

  static const _lowColor = Color(0xFF22C55E);
  static const _moderateColor = Color(0xFFF59E0B);
  static const _highColor = Color(0xFFEF4444);

  Color _fatigueColor(FatigueLevel status) {
    return switch (status) {
      FatigueLevel.low => _lowColor,
      FatigueLevel.moderate => _moderateColor,
      FatigueLevel.high => _highColor,
    };
  }

  @override
  void paint(Canvas canvas, Size size) {
    final centerX = size.width / 2;

    // Base body silhouette
    final basePaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.15)
      ..style = PaintingStyle.fill;

    // Draw simplified body shape
    _drawBodySilhouette(canvas, centerX, basePaint);

    // Draw muscle regions with fatigue colors
    for (final fatigue in fatigueData) {
      if (fatigue.level == 0) continue;
      final regions = _getMuscleRegions(fatigue.bodyPart, centerX);
      if (regions.isEmpty) continue;

      final isSelected = fatigue.bodyPart == selectedBodyPart;
      final color = _fatigueColor(fatigue.status);
      final paint = Paint()
        ..color = color.withValues(alpha: isSelected ? 0.8 : 0.5)
        ..style = PaintingStyle.fill;

      for (final rect in regions) {
        final rrect = RRect.fromRectAndRadius(rect, const Radius.circular(6));
        canvas.drawRRect(rrect, paint);
      }

      // Selection ring
      if (isSelected) {
        final ringPaint = Paint()
          ..color = Colors.white
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2;
        for (final rect in regions) {
          final rrect =
              RRect.fromRectAndRadius(rect, const Radius.circular(6));
          canvas.drawRRect(rrect, ringPaint);
        }
      }
    }
  }

  void _drawBodySilhouette(Canvas canvas, double cx, Paint paint) {
    // Head
    canvas.drawOval(Rect.fromCenter(center: Offset(cx, 25), width: 30, height: 35), paint);

    // Neck
    canvas.drawRect(Rect.fromLTWH(cx - 8, 42, 16, 14), paint);

    // Torso
    final torsoPath = Path()
      ..moveTo(cx - 35, 56)
      ..lineTo(cx - 45, 70)  // shoulder slope
      ..lineTo(cx - 35, 130) // waist in
      ..lineTo(cx - 30, 190) // hip
      ..lineTo(cx + 30, 190)
      ..lineTo(cx + 35, 130)
      ..lineTo(cx + 45, 70)
      ..lineTo(cx + 35, 56)
      ..close();
    canvas.drawPath(torsoPath, paint);

    // Left arm
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(cx - 60, 70, 18, 80),
        const Radius.circular(8),
      ),
      paint,
    );
    // Left forearm
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(cx - 58, 155, 15, 65),
        const Radius.circular(7),
      ),
      paint,
    );

    // Right arm
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(cx + 42, 70, 18, 80),
        const Radius.circular(8),
      ),
      paint,
    );
    // Right forearm
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(cx + 43, 155, 15, 65),
        const Radius.circular(7),
      ),
      paint,
    );

    // Left leg
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(cx - 28, 195, 25, 110),
        const Radius.circular(8),
      ),
      paint,
    );
    // Left calf
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(cx - 25, 310, 20, 70),
        const Radius.circular(8),
      ),
      paint,
    );

    // Right leg
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(cx + 3, 195, 25, 110),
        const Radius.circular(8),
      ),
      paint,
    );
    // Right calf
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(cx + 5, 310, 20, 70),
        const Radius.circular(8),
      ),
      paint,
    );
  }

  List<Rect> _getMuscleRegions(String bodyPart, double cx) {
    // Map body part keys to approximate screen rectangles on the body
    return switch (bodyPart) {
      'neck' => [Rect.fromLTWH(cx - 10, 42, 20, 16)],
      'shoulders' => [
        Rect.fromLTWH(cx - 48, 56, 20, 20),
        Rect.fromLTWH(cx + 28, 56, 20, 20),
      ],
      'chest' when showFront => [Rect.fromLTWH(cx - 32, 68, 64, 35)],
      'traps' when !showFront => [Rect.fromLTWH(cx - 30, 56, 60, 30)],
      'lats' when !showFront => [
        Rect.fromLTWH(cx - 38, 90, 16, 40),
        Rect.fromLTWH(cx + 22, 90, 16, 40),
      ],
      'core' when showFront => [Rect.fromLTWH(cx - 24, 110, 48, 55)],
      'lower_back' when !showFront => [Rect.fromLTWH(cx - 24, 120, 48, 45)],
      'biceps' when showFront => [
        Rect.fromLTWH(cx - 58, 78, 16, 40),
        Rect.fromLTWH(cx + 42, 78, 16, 40),
      ],
      'triceps' when !showFront => [
        Rect.fromLTWH(cx - 58, 78, 16, 40),
        Rect.fromLTWH(cx + 42, 78, 16, 40),
      ],
      'forearms' => [
        Rect.fromLTWH(cx - 56, 158, 13, 50),
        Rect.fromLTWH(cx + 43, 158, 13, 50),
      ],
      'hip_flexors' when showFront => [
        Rect.fromLTWH(cx - 26, 172, 22, 22),
        Rect.fromLTWH(cx + 4, 172, 22, 22),
      ],
      'glutes' when !showFront => [Rect.fromLTWH(cx - 28, 170, 56, 30)],
      'adductors' => [
        Rect.fromLTWH(cx - 8, 200, 16, 40),
      ],
      'quadriceps' when showFront => [
        Rect.fromLTWH(cx - 26, 200, 22, 90),
        Rect.fromLTWH(cx + 4, 200, 22, 90),
      ],
      'hamstrings' when !showFront => [
        Rect.fromLTWH(cx - 26, 200, 22, 90),
        Rect.fromLTWH(cx + 4, 200, 22, 90),
      ],
      'calves' => [
        Rect.fromLTWH(cx - 23, 315, 18, 55),
        Rect.fromLTWH(cx + 5, 315, 18, 55),
      ],
      _ => [],
    };
  }

  @override
  bool shouldRepaint(covariant _BodyPainter old) {
    return old.showFront != showFront ||
        old.selectedBodyPart != selectedBodyPart ||
        old.fatigueData != fatigueData;
  }
}

// ── Fatigue Legend ─────────────────────────────────────────

class _FatigueLegend extends StatelessWidget {
  const _FatigueLegend();

  @override
  Widget build(BuildContext context) {
    final items = [
      ('Low', const Color(0xFF22C55E)),
      ('Moderate', const Color(0xFFF59E0B)),
      ('High', const Color(0xFFEF4444)),
    ];

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: items
          .map((item) => Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: item.$2,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      item.$1,
                      style: TextStyle(
                        fontSize: 12,
                        color: Theme.of(context)
                            .colorScheme
                            .onSurface
                            .withValues(alpha: 0.5),
                      ),
                    ),
                  ],
                ),
              ))
          .toList(),
    );
  }
}

// ── Muscle Detail Card ────────────────────────────────────

class _MuscleDetailCard extends StatelessWidget {
  const _MuscleDetailCard({
    required this.bodyPart,
    required this.fatigueData,
  });

  final String bodyPart;
  final List<MuscleFatigue> fatigueData;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final fatigue = fatigueData.where((f) => f.bodyPart == bodyPart).firstOrNull;
    if (fatigue == null) return const SizedBox.shrink();

    final color = switch (fatigue.status) {
      FatigueLevel.low => const Color(0xFF22C55E),
      FatigueLevel.moderate => const Color(0xFFF59E0B),
      FatigueLevel.high => const Color(0xFFEF4444),
    };

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              const SizedBox(width: 8),
              Text(
                fatigue.muscle,
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w600),
              ),
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  fatigue.status.name.toUpperCase(),
                  style: TextStyle(
                      fontSize: 11, fontWeight: FontWeight.w700, color: color),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Progress bar
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: fatigue.level / 100,
              minHeight: 8,
              backgroundColor: theme.colorScheme.surfaceContainerHighest,
              valueColor: AlwaysStoppedAnimation(color),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Fatigue level: ${fatigue.level}%',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Daily Wellness Log Table ──────────────────────────────

class _DailyLogTable extends StatelessWidget {
  const _DailyLogTable({required this.logs});
  final List<DailyLog> logs;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (logs.isEmpty) {
      return GlassCard(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'No wellness logs yet',
              style: TextStyle(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
              ),
            ),
          ),
        ),
      );
    }

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Daily Wellness Log',
            style: theme.textTheme.labelLarge?.copyWith(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
            ),
          ),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              columnSpacing: 16,
              headingTextStyle: theme.textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w600,
                color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
              ),
              dataTextStyle: theme.textTheme.bodySmall,
              columns: const [
                DataColumn(label: Text('Date')),
                DataColumn(label: Text('Sleep'), numeric: true),
                DataColumn(label: Text('HRV'), numeric: true),
                DataColumn(label: Text('RHR'), numeric: true),
                DataColumn(label: Text('RPE'), numeric: true),
                DataColumn(label: Text('Mood'), numeric: true),
              ],
              rows: logs.map((log) {
                final hrvColor = log.hrv >= 60
                    ? const Color(0xFF22C55E)
                    : log.hrv >= 55
                        ? const Color(0xFFF59E0B)
                        : const Color(0xFFEF4444);

                return DataRow(cells: [
                  DataCell(Text(_formatDate(log.date))),
                  DataCell(Text('${log.sleepHours.toStringAsFixed(1)}h')),
                  DataCell(Text('${log.hrv}ms',
                      style: TextStyle(color: hrvColor))),
                  DataCell(Text('${log.restingHr}')),
                  DataCell(Text('${log.rpe}/10')),
                  DataCell(Text('${log.mood}/10')),
                ]);
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime dt) {
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${weekdays[dt.weekday - 1]}, ${months[dt.month - 1]} ${dt.day}';
  }
}
