import Flutter
import PushKit
import UIKit
import flutter_callkit_incoming

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate, PKPushRegistryDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // Faz 15: yerel gelen arama ekranı. PushKit, uygulama kapalıyken de CallKit'i uyandırabilir
    // (normal push bunu garanti etmez). Sunucu tarafı: server/src/voip.ts (APNS_* ayarlı değilse
    // hiç gönderilmez, bu kayıt zararsız kalır).
    let voipRegistry = PKPushRegistry(queue: .main)
    voipRegistry.delegate = self
    voipRegistry.desiredPushTypes = [.voIP]

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }

  // MARK: - PushKit (VoIP)

  func pushRegistry(_ registry: PKPushRegistry, didUpdate credentials: PKPushCredentials, for type: PKPushType) {
    guard type == .voIP else { return }
    let deviceToken = credentials.token.map { String(format: "%02x", $0) }.joined()
    SwiftFlutterCallkitIncomingPlugin.sharedInstance?.setDevicePushTokenVoIP(deviceToken)
  }

  func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
    guard type == .voIP else { return }
    SwiftFlutterCallkitIncomingPlugin.sharedInstance?.setDevicePushTokenVoIP("")
  }

  // Sunucudan gelen VoIP push (server/src/voip.ts) doğrudan buraya gelir; CallKit'e HEMEN
  // bildirilmeli — aksi halde iOS uygulamayı VoIP izni kötüye kullanıyor sayıp sonlandırabilir.
  func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    guard type == .voIP else {
      completion()
      return
    }
    let dict = payload.dictionaryPayload
    let id = dict["id"] as? String ?? UUID().uuidString
    let nameCaller = dict["nameCaller"] as? String ?? "MeetPoint"
    let handle = dict["handle"] as? String ?? nameCaller
    let isVideo = dict["isVideo"] as? Bool ?? false

    let data = flutter_callkit_incoming.Data(id: id, nameCaller: nameCaller, handle: handle, type: isVideo ? 1 : 0)
    data.extra = ["callId": id]
    SwiftFlutterCallkitIncomingPlugin.sharedInstance?.showCallkitIncoming(data, fromPushKit: true)

    // completion() sistem çökmesin diye kısa süre içinde çağrılmalı (bkz. paket dokümantasyonu)
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
      completion()
    }
  }
}
