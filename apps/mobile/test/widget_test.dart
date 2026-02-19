import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:jpx_workout/app/app.dart';

void main() {
  testWidgets('App renders without crashing', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: JpxApp(),
      ),
    );

    // Verify app builds successfully
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
