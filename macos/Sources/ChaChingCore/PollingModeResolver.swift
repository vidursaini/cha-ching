import Foundation

public enum PollingModeResolver {
    public static func shouldUseDemoOnly(demoMode: Bool, hasDeviceToken: Bool) -> Bool {
        demoMode && !hasDeviceToken
    }
}
