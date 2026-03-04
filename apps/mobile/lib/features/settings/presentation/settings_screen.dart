import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../auth/providers/auth_provider.dart';
import '../data/models/integration_models.dart';
import '../providers/integration_provider.dart';
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
  final Set<String> _busyProviders = <String>{};
  static const _appLinkUrl = String.fromEnvironment(
    'APP_LINK_URL',
    defaultValue: 'https://jpx.nu/workout/settings',
  );

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final profileAsync = ref.watch(profileNotifierProvider);
    final integrationAsync = ref.watch(integrationStatusProvider);

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
              children: integrationAsync.when(
                loading: () => const [
                  Padding(
                    padding: EdgeInsets.all(20),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                ],
                error: (_, __) => [
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Failed to load integration status',
                          style: TextStyle(color: theme.colorScheme.error),
                        ),
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: () => ref.invalidate(
                            integrationStatusProvider,
                          ),
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                ],
                data: (snapshot) =>
                    _buildIntegrationTiles(context, snapshot),
              ),
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

  List<Widget> _buildIntegrationTiles(
    BuildContext context,
    IntegrationStatusSnapshot snapshot,
  ) {
    final theme = Theme.of(context);
    final integrations = [...snapshot.integrations]
      ..sort((a, b) => a.provider.compareTo(b.provider));

    final tiles = integrations.map((integration) {
      final statusLabel = integration.available
          ? (integration.connected ? 'Connected' : 'Not connected')
          : 'Pending';
      final statusColor = integration.available
          ? (integration.connected
              ? const Color(0xFF22C55E)
              : theme.colorScheme.onSurface.withValues(alpha: 0.45))
          : const Color(0xFFF59E0B);

      String subtitle;
      subtitle = _integrationSubtitle(integration);

      return _SettingsTile(
        icon: _providerIcon(integration.provider),
        title: _providerLabel(integration.provider),
        subtitle: subtitle,
        onTap: () => _showIntegrationActions(context, integration),
        trailing: _busyProviders.contains(integration.provider)
            ? const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Text(
                statusLabel,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: statusColor,
                ),
              ),
      );
    }).toList();

    final queueColor = snapshot.webhookQueueSize > 0
        ? const Color(0xFFF59E0B)
        : const Color(0xFF22C55E);

    if (integrations.isEmpty) {
      tiles.add(
        _SettingsTile(
          icon: LucideIcons.shieldCheck,
          title: 'No providers registered',
          subtitle: 'No integration providers are available right now.',
          onTap: null,
        ),
      );
    }

    tiles.add(
      _SettingsTile(
        icon: LucideIcons.activity,
        title: 'Sync Queue',
        subtitle: 'Pending background webhook sync jobs',
        onTap: null,
        trailing: Text(
          '${snapshot.webhookQueueSize}',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: queueColor,
          ),
        ),
      ),
    );

    return tiles;
  }

  Future<void> _showIntegrationActions(
    BuildContext context,
    IntegrationStatus integration,
  ) async {
    final theme = Theme.of(context);
    final connectLabel = integration.available ? 'Connect' : 'Apply';
    final connectPath = integration.actions.connect;

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: Icon(
                _providerIcon(integration.provider),
                color: theme.colorScheme.primary,
              ),
              title: Text(_providerLabel(integration.provider)),
              subtitle: Text(_integrationSubtitle(integration)),
            ),
            if (!integration.connected)
              ListTile(
                leading: const Icon(LucideIcons.link),
                title: Text(connectLabel),
                subtitle: Text(integration.available
                    ? 'Open provider OAuth flow in browser'
                    : 'Open provider application page'),
                enabled: connectPath != null || integration.applyUrl != null,
                onTap: () async {
                  Navigator.of(ctx).pop();
                  await _connectIntegration(integration);
                },
              ),
            if (integration.connected) ...[
              ListTile(
                leading: const Icon(LucideIcons.refreshCcw),
                title: const Text('Sync now'),
                subtitle: const Text('Trigger manual sync immediately'),
                onTap: () async {
                  Navigator.of(ctx).pop();
                  await _syncIntegration(integration);
                },
              ),
              ListTile(
                leading: Icon(
                  LucideIcons.unlink,
                  color: theme.colorScheme.error,
                ),
                title: Text(
                  'Disconnect',
                  style: TextStyle(color: theme.colorScheme.error),
                ),
                subtitle: const Text('Disconnect this provider account'),
                onTap: () async {
                  Navigator.of(ctx).pop();
                  await _disconnectIntegration(integration);
                },
              ),
            ],
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  Future<void> _connectIntegration(IntegrationStatus integration) async {
    final repo = ref.read(integrationRepositoryProvider);
    final target = integration.available
        ? integration.actions.connect
        : integration.applyUrl;
    if (target == null || target.isEmpty) {
      _showSnack('No connect URL available for ${_providerLabel(integration.provider)}');
      return;
    }

    final baseUri = repo.buildAbsoluteUri(target);
    final uri = integration.available
        ? baseUri.replace(
            queryParameters: {
              ...baseUri.queryParameters,
              'returnTo': _appLinkUrl,
            },
          )
        : baseUri;
    final launched = await launchUrl(
      uri,
      mode: LaunchMode.externalApplication,
    );
    if (!launched) {
      _showSnack('Failed to open browser for ${_providerLabel(integration.provider)}');
      return;
    }

    _showSnack('Complete connection in browser, then refresh status.');
  }

  Future<void> _syncIntegration(IntegrationStatus integration) async {
    final provider = integration.provider;
    setState(() => _busyProviders.add(provider));
    try {
      await ref.read(integrationRepositoryProvider).syncIntegration(integration);
      ref.invalidate(integrationStatusProvider);
      _showSnack('${_providerLabel(provider)} sync started.');
    } on DioException catch (e) {
      _showSnack(_extractApiError(e));
    } catch (_) {
      _showSnack('Failed to sync ${_providerLabel(provider)}.');
    } finally {
      if (mounted) {
        setState(() => _busyProviders.remove(provider));
      }
    }
  }

  Future<void> _disconnectIntegration(IntegrationStatus integration) async {
    final provider = integration.provider;
    setState(() => _busyProviders.add(provider));
    try {
      await ref
          .read(integrationRepositoryProvider)
          .disconnectIntegration(integration);
      ref.invalidate(integrationStatusProvider);
      _showSnack('${_providerLabel(provider)} disconnected.');
    } on DioException catch (e) {
      _showSnack(_extractApiError(e));
    } catch (_) {
      _showSnack('Failed to disconnect ${_providerLabel(provider)}.');
    } finally {
      if (mounted) {
        setState(() => _busyProviders.remove(provider));
      }
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  String _extractApiError(DioException error) {
    final data = error.response?.data;
    if (data is Map<String, dynamic>) {
      final detail = data['detail'] as String?;
      final title = data['title'] as String?;
      final fallback = data['error'] as String?;
      return detail ?? title ?? fallback ?? 'Request failed.';
    }
    return 'Request failed.';
  }

  String _providerLabel(String provider) {
    return switch (provider.toUpperCase()) {
      'STRAVA' => 'Strava',
      'GARMIN' => 'Garmin',
      'POLAR' => 'Polar',
      'WAHOO' => 'Wahoo',
      _ => provider,
    };
  }

  IconData _providerIcon(String provider) {
    return switch (provider.toUpperCase()) {
      'STRAVA' => LucideIcons.activity,
      'GARMIN' => LucideIcons.watch,
      'POLAR' => LucideIcons.heartPulse,
      'WAHOO' => LucideIcons.bike,
      _ => LucideIcons.shieldCheck,
    };
  }

  String _integrationSubtitle(IntegrationStatus integration) {
    if (!integration.available) {
      return 'Unavailable (${integration.availabilityReason ?? 'pending'})';
    }
    if (!integration.connected) return 'Not connected';
    if (integration.lastSyncAt == null) return 'Connected, waiting for first sync';

    final local = integration.lastSyncAt!.toLocal();
    final elapsed = DateTime.now().difference(local);
    if (elapsed.inHours < 6) return 'Synced recently';
    if (elapsed.inHours < 24) return 'Sync stale (${elapsed.inHours}h ago)';
    return 'Sync stale (${elapsed.inDays}d ago)';
  }
}

// ── Static data ───────────────────────────────────────────

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
