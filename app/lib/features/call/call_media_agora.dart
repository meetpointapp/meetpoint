import 'dart:async';

import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../core/models.dart';
import 'call_media.dart';

CallMediaEngine createMediaEngine() {
  final mobile = defaultTargetPlatform == TargetPlatform.android || defaultTargetPlatform == TargetPlatform.iOS;
  return mobile ? _AgoraMedia() : simulatedMediaEngine();
}

class _AgoraMedia implements CallMediaEngine {
  RtcEngine? _engine;
  String _channel = '';
  int? _remoteUid;
  final _joined = Completer<void>();

  @override
  final remoteJoined = ValueNotifier(false);

  @override
  bool get isReal => true;

  // Agora sunucusunun "kanala gerçekten katıldın" onayı (onJoinChannelSuccess); sadece istemcinin
  // joinChannel() çağırması yetmez, bu olayı beklemek gerekir (Faz 15: adil ücretlendirme).
  @override
  Future<void> get joined => _joined.future;

  @override
  Future<void> start({required CallMedia? media, required bool video}) async {
    if (media == null) return;
    await [Permission.microphone, if (video) Permission.camera].request();

    final engine = createAgoraRtcEngine();
    _engine = engine;
    _channel = media.channel;
    await engine.initialize(RtcEngineContext(
      appId: media.appId,
      channelProfile: ChannelProfileType.channelProfileCommunication,
    ));
    engine.registerEventHandler(RtcEngineEventHandler(
      onJoinChannelSuccess: (_, _) {
        if (!_joined.isCompleted) _joined.complete();
      },
      onUserJoined: (_, uid, _) {
        _remoteUid = uid;
        remoteJoined.value = true;
      },
      onUserOffline: (_, uid, _) {
        if (uid == _remoteUid) remoteJoined.value = false;
      },
    ));
    if (video) {
      await engine.enableVideo();
      await engine.startPreview();
    }
    await engine.setDefaultAudioRouteToSpeakerphone(video);
    await engine.joinChannel(
      token: media.token ?? '',
      channelId: media.channel,
      uid: media.uid,
      options: ChannelMediaOptions(
        clientRoleType: ClientRoleType.clientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: video,
        autoSubscribeAudio: true,
        autoSubscribeVideo: video,
      ),
    );
  }

  @override
  Future<void> setMuted(bool muted) async => _engine?.muteLocalAudioStream(muted);

  @override
  Future<void> setCameraOn(bool on) async => _engine?.enableLocalVideo(on);

  @override
  Future<void> switchCamera() async => _engine?.switchCamera();

  @override
  Future<void> setSpeaker(bool on) async => _engine?.setEnableSpeakerphone(on);

  @override
  Widget? remoteView() {
    final engine = _engine;
    final uid = _remoteUid;
    if (engine == null || uid == null) return null;
    return AgoraVideoView(
      controller: VideoViewController.remote(
        rtcEngine: engine,
        canvas: VideoCanvas(uid: uid),
        connection: RtcConnection(channelId: _channel),
      ),
    );
  }

  @override
  Widget? localView() {
    final engine = _engine;
    if (engine == null) return null;
    return AgoraVideoView(controller: VideoViewController(rtcEngine: engine, canvas: const VideoCanvas(uid: 0)));
  }

  @override
  Future<void> dispose() async {
    final engine = _engine;
    _engine = null;
    remoteJoined.dispose();
    if (engine == null) return;
    await engine.leaveChannel().catchError((_) {});
    await engine.release().catchError((_) {});
  }
}
