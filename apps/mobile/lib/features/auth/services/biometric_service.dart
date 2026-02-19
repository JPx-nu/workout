import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';
import '../../../core/storage/secure_storage.dart';

/// Manages biometric authentication (Face ID / fingerprint).
/// On web, biometrics are gracefully disabled since `local_auth` is native-only.
class BiometricService {
  BiometricService(this._auth, this._storage);

  final LocalAuthentication _auth;
  final FlutterSecureStorage _storage;

  /// Whether the device supports biometrics.
  Future<bool> get isAvailable async {
    if (kIsWeb) return false;
    try {
      final canCheck = await _auth.canCheckBiometrics;
      final isDeviceSupported = await _auth.isDeviceSupported();
      return canCheck && isDeviceSupported;
    } on PlatformException {
      return false;
    }
  }

  /// Available biometric types on this device.
  Future<List<BiometricType>> get availableBiometrics async {
    if (kIsWeb) return [];
    try {
      return await _auth.getAvailableBiometrics();
    } on PlatformException {
      return [];
    }
  }

  /// Prompt the user for biometric authentication.
  Future<bool> authenticate({
    String reason = 'Authenticate to access JPx Workout',
  }) async {
    if (kIsWeb) return false;
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: false, // allow PIN/pattern fallback
        ),
      );
    } on PlatformException {
      return false;
    }
  }

  /// Whether the user has enabled biometric lock in settings.
  Future<bool> get isEnabled async {
    final value = await _storage.read(key: StorageKeys.biometricEnabled);
    return value == 'true';
  }

  /// Enable or disable biometric lock.
  Future<void> setEnabled(bool enabled) async {
    await _storage.write(
      key: StorageKeys.biometricEnabled,
      value: enabled.toString(),
    );
  }
}

/// Provides the BiometricService singleton.
final biometricServiceProvider = Provider<BiometricService>((ref) {
  final storage = ref.watch(secureStorageProvider);
  return BiometricService(LocalAuthentication(), storage);
});
