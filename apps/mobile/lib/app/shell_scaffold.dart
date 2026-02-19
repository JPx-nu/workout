import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

class ShellScaffold extends StatelessWidget {
  const ShellScaffold({
    super.key,
    required this.navigationShell,
  });

  final StatefulNavigationShell navigationShell;

  static const _tabs = [
    (icon: LucideIcons.layoutDashboard, label: 'Dashboard'),
    (icon: LucideIcons.dumbbell, label: 'Workouts'),
    (icon: LucideIcons.calendar, label: 'Training'),
    (icon: LucideIcons.brain, label: 'Coach'),
    (icon: LucideIcons.settings, label: 'Settings'),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (index) {
          navigationShell.goBranch(
            index,
            initialLocation: index == navigationShell.currentIndex,
          );
        },
        destinations: _tabs.map((tab) {
          return NavigationDestination(
            icon: Icon(tab.icon, size: 22),
            selectedIcon: Icon(
              tab.icon,
              size: 22,
              color: theme.colorScheme.primary,
            ),
            label: tab.label,
          );
        }).toList(),
      ),
    );
  }
}
