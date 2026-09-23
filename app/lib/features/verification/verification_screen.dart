import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Mavi tik başvurusu: sunucunun verdiği pozda selfie çek, gönder, yönetim onaylasın
class VerificationScreen extends ConsumerStatefulWidget {
  const VerificationScreen({super.key});

  @override
  ConsumerState<VerificationScreen> createState() => _VerificationScreenState();
}

class _VerificationScreenState extends ConsumerState<VerificationScreen> {
  String? _pose;
  Object? _error;
  XFile? _selfie;
  Uint8List? _preview;
  bool _busy = false;
  bool _submitted = false;

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    final status = (await ref.read(meProvider.future)).verificationStatus;
    if (status == 'pending' || status == 'approved') {
      if (mounted) setState(() => _submitted = true);
      return;
    }
    try {
      final pose = await ref.read(apiProvider).startVerification();
      if (mounted) setState(() => _pose = pose);
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _take() async {
    final file = await ImagePicker().pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      maxWidth: 1280,
      imageQuality: 85,
    );
    if (file == null) return;
    final bytes = await file.readAsBytes();
    setState(() {
      _selfie = file;
      _preview = bytes;
    });
  }

  Future<void> _submit() async {
    final l = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).uploadSelfie(_selfie!);
      ref.invalidate(meProvider);
      if (mounted) setState(() => _submitted = true);
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyLarge?.copyWith(color: theme.colorScheme.onSurfaceVariant);

    Widget body;
    if (_submitted) {
      final approved = ref.watch(meProvider).value?.verificationStatus == 'approved';
      body = CenteredMessage(
        icon: approved ? Icons.verified_rounded : Icons.hourglass_top_rounded,
        text: approved ? l.verifiedLabel : l.verificationSubmitted,
        action: FilledButton(onPressed: () => Navigator.pop(context), child: Text(l.done)),
      );
    } else if (_error != null) {
      body = ErrorRetry(error: _error!, onRetry: () {
        setState(() => _error = null);
        _start();
      });
    } else if (_pose == null) {
      body = const Center(child: CircularProgressIndicator());
    } else {
      body = ListView(padding: const EdgeInsets.fromLTRB(24, 8, 24, 24), children: [
        Text(l.verifyTitle, style: theme.textTheme.headlineMedium),
        const SizedBox(height: 8),
        Text(l.verifyStep, style: muted),
        const SizedBox(height: 24),
        // İstenen poz
        Container(
          padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(Brand.radius),
            color: Brand.coral.withValues(alpha: 0.08),
            border: Border.all(color: Brand.coral.withValues(alpha: 0.4)),
          ),
          child: Text(l.poseLabel(_pose!),
              textAlign: TextAlign.center, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
        ),
        const SizedBox(height: 20),
        if (_preview != null)
          Center(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(Brand.radius),
              child: Image.memory(_preview!, height: 320, fit: BoxFit.cover),
            ),
          ),
        const SizedBox(height: 20),
        if (_preview == null)
          GradientButton(label: l.takeSelfie, icon: Icons.photo_camera_front_rounded, onPressed: _take)
        else ...[
          GradientButton(label: l.send, icon: Icons.send_rounded, busy: _busy, onPressed: _submit),
          const SizedBox(height: 8),
          OutlinedButton(onPressed: _busy ? null : _take, child: Text(l.retake)),
        ],
      ]);
    }

    return Scaffold(appBar: AppBar(), body: SafeArea(child: body));
  }
}
