import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../auth/providers/auth_provider.dart';
import '../providers/profile_provider.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  // Local notification toggle state
  final Map<String, bool> _notifications = {
    'training': true,
    'coach': true,
    'relay': true,
    'recovery': false,
  };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final profileAsync = ref.watch(profileNotifierProvider);

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // ── Header ──
            Text(
              'Settings',
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            Text(
              'Profile, devices, and preferences',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
              ),
            ),
            const SizedBox(height: 24),

            // ── Profile section ──
            _SettingsSection(
              title: 'Profile',
              children: [
                profileAsync.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.all(20),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                  error: (e, _) => Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text('Error: $e',
                        style: TextStyle(color: theme.colorScheme.error)),
                  ),
                  data: (profile) => Column(
                    children: [
                      _SettingsTile(
                        icon: LucideIcons.user,
                        title: profile.displayName.isEmpty
                            ? 'User'
                            : profile.displayName,
                        subtitle: profile.email,
                        onTap: null,
                      ),
                      if (profile.clubName.isNotEmpty)
                        _SettingsTile(
                          icon: LucideIcons.users,
                          title: 'Club',
                          subtitle: profile.clubName,
                          onTap: null,
                        ),
                      _SettingsTile(
                        icon: LucideIcons.shield,
                        title: 'Role',
                        subtitle: profile.role[0].toUpperCase() +
                            profile.role.substring(1),
                        onTap: null,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // ── Dashboard View ──
            _SettingsSection(
              title: 'Dashboard View',
              children: [
                profileAsync.when(
                  loading: () => const SizedBox(height: 60),
                  error: (e, st) => const SizedBox.shrink(),
                  data: (profile) => Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 8),
                    child: Row(
                      children: [
                        Expanded(
                          child: _ViewToggleButton(
                            label: 'Triathlon',
                            subtitle: 'Swim, Bike, Run focus',
                            isActive: profile.defaultView == 'triathlon',
                            color: theme.colorScheme.primary,
                            onTap: () => ref
                                .read(profileNotifierProvider.notifier)
                                .updateDefaultView('triathlon'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _ViewToggleButton(
                            label: 'Strength',
                            subtitle: 'Lifting & Recovery focus',
                            isActive: profile.defaultView == 'strength',
                            color: Colors.orange,
                            onTap: () => ref
                                .read(profileNotifierProvider.notifier)
                                .updateDefaultView('strength'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // ── Connected Devices ──
            _SettingsSection(
              title: 'Connected Devices',
              children: _connectedDevices
                  .map((device) => _SettingsTile(
                        icon: device.icon,
                        title: device.name,
                        subtitle: device.status,
                        onTap: null,
                        trailing: Text(
                          device.status,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: device.statusColor,
                          ),
                        ),
                      ))
                  .toList(),
            ),
            const SizedBox(height: 20),

            // ── Notifications ──
            _SettingsSection(
              title: 'Notifications',
              children: _notificationPrefs.map((pref) {
                final isOn = _notifications[pref.key] ?? false;
                return _SettingsTile(
                  icon: LucideIcons.bell,
                  title: pref.label,
                  subtitle: pref.description,
                  onTap: () => setState(
                      () => _notifications[pref.key] = !isOn),
                  trailing: Switch(
                    value: isOn,
                    onChanged: (value) => setState(
                        () => _notifications[pref.key] = value),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 20),

            // ── App ──
            _SettingsSection(
              title: 'App',
              children: [
                _SettingsTile(
                  icon: LucideIcons.palette,
                  title: 'Appearance',
                  subtitle: 'Dark, Light, or System',
                  onTap: () {},
                ),
                _SettingsTile(
                  icon: LucideIcons.shieldCheck,
                  title: 'Biometric Lock',
                  subtitle: 'Fingerprint or Face ID',
                  onTap: null,
                  trailing: Switch(
                    value: false,
                    onChanged: (_) {},
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // ── About ──
            const _SettingsSection(
              title: 'About',
              children: [
                _SettingsTile(
                  icon: LucideIcons.info,
                  title: 'Version',
                  subtitle: '1.0.0 (1)',
                  onTap: null,
                ),
              ],
            ),
            const SizedBox(height: 32),

            // ── Sign Out ──
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => _showSignOutDialog(context),
                icon: const Icon(LucideIcons.logOut, size: 18),
                label: const Text('Sign Out'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: theme.colorScheme.error,
                  side: BorderSide(
                    color: theme.colorScheme.error.withValues(alpha: 0.3),
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showSignOutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              ref.read(authProvider.notifier).signOut();
            },
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }
}

// ── Static data ───────────────────────────────────────────

class _DeviceInfo {
  const _DeviceInfo(this.name, this.icon, this.status, this.statusColor);
  final String name;
  final IconData icon;
  final String status;
  final Color statusColor;
}

const _connectedDevices = [
  _DeviceInfo('Garmin Fenix 8', LucideIcons.watch, 'Connected',
      Color(0xFF22C55E)),
  _DeviceInfo('FORM Smart Goggles', LucideIcons.smartphone, 'Connected',
      Color(0xFF22C55E)),
  _DeviceInfo(
      'Wahoo KICKR', LucideIcons.heartPulse, 'Pending', Color(0xFFF59E0B)),
  _DeviceInfo('Apple Health', LucideIcons.shieldCheck, 'Not connected',
      Color(0xFF6B7280)),
];

class _NotifPref {
  const _NotifPref(this.key, this.label, this.description);
  final String key;
  final String label;
  final String description;
}

const _notificationPrefs = [
  _NotifPref('training', 'Training reminders', 'Daily session notifications'),
  _NotifPref('coach', 'AI Coach insights', 'Weekly performance summaries'),
  _NotifPref('relay', 'Relay baton passes', 'When a teammate passes the baton'),
  _NotifPref(
      'recovery', 'Recovery alerts', 'When readiness drops below threshold'),
];

// ── Reusable Widgets ──────────────────────────────────────

class _SettingsSection extends StatelessWidget {
  const _SettingsSection({
    required this.title,
    required this.children,
  });

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: theme.textTheme.labelLarge?.copyWith(
            color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: theme.colorScheme.surfaceContainerHighest
                .withValues(alpha: 0.3),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(children: children),
        ),
      ],
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.trailing,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ListTile(
      leading: Icon(icon, size: 20, color: theme.colorScheme.primary),
      title: Text(title, style: const TextStyle(fontSize: 15)),
      subtitle: Text(
        subtitle,
        style: TextStyle(
          fontSize: 12,
          color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
        ),
      ),
      trailing: trailing ??
          (onTap != null
              ? Icon(
                  LucideIcons.chevronRight,
                  size: 16,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.3),
                )
              : null),
      onTap: onTap,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
    );
  }
}

class _ViewToggleButton extends StatelessWidget {
  const _ViewToggleButton({
    required this.label,
    required this.subtitle,
    required this.isActive,
    required this.color,
    required this.onTap,
  });

  final String label;
  final String subtitle;
  final bool isActive;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isActive ? color : Colors.transparent,
            width: 1.5,
          ),
          color: isActive
              ? color.withValues(alpha: 0.08)
              : theme.colorScheme.surfaceContainerHighest
                  .withValues(alpha: 0.2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: isActive ? color : theme.colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: TextStyle(
                fontSize: 11,
                color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
