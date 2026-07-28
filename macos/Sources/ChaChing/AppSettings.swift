import Foundation

struct AppSettings {
    private static let licenseDefaultsKey = "ChaChing.licenseKey"
    private static let licenseKeychainAccount = "licenseKey"

    var baseURLString: String {
        get {
            if AppRuntimeConfiguration.current.distribution == .hosted {
                return AppRuntimeConfiguration.hostedBaseURL
            }
            return UserDefaults.standard.string(forKey: "ChaChing.baseURL") ?? ""
        }
        set {
            guard AppRuntimeConfiguration.current.distribution == .community else { return }
            UserDefaults.standard.set(newValue, forKey: "ChaChing.baseURL")
        }
    }

    var licenseKey: String {
        get {
            guard AppRuntimeConfiguration.current.distribution == .hosted else { return "" }
            if let keychainValue = KeychainStore.read(Self.licenseKeychainAccount) {
                UserDefaults.standard.removeObject(forKey: Self.licenseDefaultsKey)
                return keychainValue
            }

            let legacyValue = UserDefaults.standard.string(forKey: Self.licenseDefaultsKey) ?? ""
            if !legacyValue.isEmpty {
                KeychainStore.write(legacyValue, account: Self.licenseKeychainAccount)
                UserDefaults.standard.removeObject(forKey: Self.licenseDefaultsKey)
            }
            return legacyValue
        }
        set {
            guard AppRuntimeConfiguration.current.distribution == .hosted else { return }
            UserDefaults.standard.removeObject(forKey: Self.licenseDefaultsKey)
            if newValue.isEmpty {
                KeychainStore.delete(Self.licenseKeychainAccount)
            } else {
                KeychainStore.write(newValue, account: Self.licenseKeychainAccount)
            }
        }
    }

    var muteCelebrations: Bool {
        get { UserDefaults.standard.bool(forKey: "ChaChing.muteCelebrations") }
        set { UserDefaults.standard.set(newValue, forKey: "ChaChing.muteCelebrations") }
    }

    var autoDismissPopups: Bool {
        get { UserDefaults.standard.bool(forKey: "ChaChing.autoDismissPopups") }
        set { UserDefaults.standard.set(newValue, forKey: "ChaChing.autoDismissPopups") }
    }

    var demoMode: Bool {
        get { UserDefaults.standard.bool(forKey: "ChaChing.demoMode") }
        set { UserDefaults.standard.set(newValue, forKey: "ChaChing.demoMode") }
    }
}
