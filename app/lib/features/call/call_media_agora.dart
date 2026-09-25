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
  CallMedia? _lastMedia;
  bool _lastVideo = false;
  String? _currentToken;
  final _joined = Completer<void>();
  final _tokenExpiring = StreamController<void>.broadcast();

  @override
  final remoteJoined = ValueNotifier(false);

  @override
  final weakConnection = ValueNotifier(false);

  @override
  bool get isReal => true;

  // Agora sunucusunun "kanala gerçekten katıldın" onayı (onJoinChannelSuccess); sadece istemcinin
  // joinChannel() çağırması yetmez, bu olayı beklemek gerekir (Faz 15: adil ücretlendirme).
  @override
  Future<void> get joined => _joined.future;

  @override
  Stream<void> get tokenExpiring => _tokenExpiring.stream;

  @override
  Future<void> renewToken(String token) async {
    _currentToken = token;
    await _engine?.renewToken(token);
  }

  @override
  Future<void> start({required CallMedia? media, required bool video}) async {
    if (media == null) return;
    await [Permission.microphone, if (video) Permission.camera].request();

    final engine = createAgoraRtcEngine();
    _engine = engine;
    _channel = media.channel;
    _lastMedia = media;
    _lastVideo = video;
    _currentToken = media.token;
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
      // Jeton ~30 sn içinde geçersiz olacak: sunucudan yeni jeton alınıp renewToken'a verilmeli
      onTokenPrivilegeWillExpire: (_, _) => _tokenExpiring.add(null),
      // Kendi bağlantımızın (uid 0) kalitesi kötüyse kullanıcıya göster
      onNetworkQuality: (_, remoteUid, txQuality, rxQuality) {
        if (remoteUid != 0) return;
        const poor = {QualityType.qualityPoor, QualityType.qualityBad, QualityType.qualityVbad, QualityType.qualityDown};
        weakConnection.value = poor.contains(txQuality) || poor.contains(rxQuality);
      },
      // Ağ değişince (Wi-Fi↔mobil veri) veya kısa kesintide Agora kendi içinde yeniden dener
      // (connectionStateReconnecting); 20 dakika içinde başaramazsa (connectionStateFailed) burada
      // elle yeniden katılım denenir.
      onConnectionStateChanged: (_, state, _) {
        if (state == ConnectionStateType.connectionStateReconnecting) {
          weakConnection.value = true;
        } else if (state == ConnectionStateType.connectionStateFailed) {
          weakConnection.value = true;
          unawaited(_rejoin());
        }
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

  // Ağ, 20 dakikalık otomatik yeniden deneme süresinde toparlanmadıysa: kanaldan çık, tekrar katıl.
  Future<void> _rejoin() async {
    final engine = _engine;
    final media = _lastMedia;
    if (engine == null || media == null) return;
    try {
      await engine.leaveChannel();
      await engine.joinChannel(
        token: _currentToken ?? media.token ?? '',
        channelId: media.channel,
        uid: media.uid,
        options: ChannelMediaOptions(
          clientRoleType: ClientRoleType.clientRoleBroadcaster,
          publishMicrophoneTrack: true,
          publishCameraTrack: _lastVideo,
          autoSubscribeAudio: true,
          autoSubscribeVideo: _lastVideo,
        ),
      );
    } catch (e) {
      debugPrint('rejoin failed: $e');
    }
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
    weakConnection.dispose();
    unawaited(_tokenExpiring.close());
    if (engine == null) return;
    await engine.leaveChannel().catchError((_) {});
    await engine.release().catchError((_) {});
  }
}
