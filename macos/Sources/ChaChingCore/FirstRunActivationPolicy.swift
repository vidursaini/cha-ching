import Foundation

public enum FirstRunActivationPolicy {
    public static func shouldOpenConnectWindow(
        hasDeviceToken: Bool,
        isAutoDemoRequested: Bool
    ) -> Bool {
        !hasDeviceToken && !isAutoDemoRequested
    }
}
