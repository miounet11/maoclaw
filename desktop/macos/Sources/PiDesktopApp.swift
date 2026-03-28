import AppKit
import WebKit

final class PiDesktopApp: NSObject, NSApplicationDelegate, NSWindowDelegate, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    private enum DesktopSurfaceMode: String {
        case native
        case web

        init(storageValue: String?) {
            switch storageValue?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
            case "web":
                self = .web
            default:
                self = .native
            }
        }
    }

    private enum CloseBehavior: String {
        case background
        case quit
    }

    private let bridge = PiDesktopBridge()
    private var window: NSWindow?
    private var webView: WKWebView?
    private var statusItem: NSStatusItem?
    private var surfaceAccessoryController: NSTitlebarAccessoryViewController?
    private var surfaceSelector: NSSegmentedControl?
    private var browserSurfaceButton: NSButton?
    private var webLoadTimeoutWorkItem: DispatchWorkItem?
    private var lastWebSurfaceError: String?
    private var currentSurface: DesktopSurfaceMode = .native
    private var hostSettings = DesktopHostSettings(
        preferredSurface: "native",
        webWorkspaceURL: "https://xinxiang.xin",
        closeBehavior: "background",
        menuBarEnabled: true
    )

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        bridge.pruneStaleHelperProcesses()
        hostSettings = bridge.currentHostSettings()
        configureStatusItem()

        let contentController = WKUserContentController()
        contentController.add(self, name: "piHost")
        contentController.add(self, name: "piConsole")
        contentController.addUserScript(
            WKUserScript(
                source: consoleBridgeScript(),
                injectionTime: .atDocumentStart,
                forMainFrameOnly: false
            )
        )

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = contentController
        configuration.preferences.setValue(true, forKey: "developerExtrasEnabled")

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        if #available(macOS 13.3, *) {
            webView.isInspectable = true
        }
        bridge.attach(webView: webView)
        self.webView = webView

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1440, height: 920),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "猫爪 maoclaw"
        window.titlebarAppearsTransparent = true
        window.isReleasedWhenClosed = false
        window.backgroundColor = NSColor(calibratedRed: 0.97, green: 0.95, blue: 0.91, alpha: 1.0)
        window.center()
        window.contentView = webView
        window.delegate = self
        configureSurfaceAccessory(for: window)
        self.window = window

        let preferredSurface = DesktopSurfaceMode(storageValue: hostSettings.preferredSurface)
        loadSurface(preferredSurface, activate: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        closeBehavior() == .quit
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag {
            showWindow()
        }
        return true
    }

    func applicationDidBecomeActive(_ notification: Notification) {
        guard closeBehavior() == .background else {
            return
        }
        let hasVisibleWindow = window?.isVisible == true
        if !hasVisibleWindow {
            showWindow()
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        bridge.applicationWillTerminate()
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        if closeBehavior() == .background {
            hideToBackground()
            return false
        }
        return true
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "piConsole" {
            bridge.handleConsole(message: message)
            return
        }

        guard let body = message.body as? [String: Any] else {
            bridge.handle(message: message)
            return
        }

        let action = body["action"] as? String ?? ""
        let requestId = body["requestId"] as? String
        let payload = body["payload"] as? [String: Any] ?? [:]

        switch action {
        case "saveHostSettings":
            handleSaveHostSettings(requestId: requestId, payload: payload)
        case "switchDesktopSurface":
            handleSwitchDesktopSurface(requestId: requestId, payload: payload)
        case "openWebWorkspaceExternal":
            handleOpenWebWorkspaceExternal(requestId: requestId)
        default:
            bridge.handle(message: message)
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        cancelWebLoadWatchdog()
        lastWebSurfaceError = nil
        bridge.noteWebEvent("finished loading \(webView.url?.absoluteString ?? "unknown page")")
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleNavigationFailure(error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        handleNavigationFailure(error)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        bridge.noteWebEvent("web content process terminated; reloading")
        webView.reload()
    }

    @objc private func showWindowFromMenu(_ sender: Any?) {
        showWindow()
    }

    @objc private func openNativeControlCenterFromMenu(_ sender: Any?) {
        loadSurface(.native, activate: true)
    }

    @objc private func openWebWorkspaceFromMenu(_ sender: Any?) {
        loadSurface(.web, activate: true)
    }

    @objc private func openWebWorkspaceInBrowserFromMenu(_ sender: Any?) {
        openWebWorkspaceExternally()
    }

    @objc private func surfaceSelectorChanged(_ sender: NSSegmentedControl) {
        let mode: DesktopSurfaceMode = sender.selectedSegment == 1 ? .web : .native
        loadSurface(mode, activate: true)
    }

    @objc private func toggleBackgroundBehaviorFromMenu(_ sender: Any?) {
        let next = closeBehavior() == .background ? "quit" : "background"
        saveHostSettings([
            "preferredSurface": hostSettings.preferredSurface ?? currentSurface.rawValue,
            "webWorkspaceURL": hostSettings.webWorkspaceURL ?? "https://xinxiang.xin",
            "closeBehavior": next,
            "menuBarEnabled": next == "background" ? true : (hostSettings.menuBarEnabled ?? true)
        ])
    }

    @objc private func quitFromMenu(_ sender: Any?) {
        NSApp.terminate(nil)
    }

    private func configureStatusItem() {
        let shouldShow = hostSettings.menuBarEnabled ?? true
        if shouldShow && statusItem == nil {
            let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
            item.button?.title = "猫爪"
            statusItem = item
        } else if !shouldShow, let item = statusItem {
            NSStatusBar.system.removeStatusItem(item)
            statusItem = nil
        }
        updateStatusMenu()
    }

    private func configureSurfaceAccessory(for window: NSWindow) {
        let controller = NSTitlebarAccessoryViewController()
        controller.layoutAttribute = .right

        let selector = NSSegmentedControl(labels: ["Native", "Web"], trackingMode: .selectOne, target: self, action: #selector(surfaceSelectorChanged(_:)))
        selector.selectedSegment = currentSurface == .web ? 1 : 0
        selector.toolTip = "Switch between the native control center and the embedded web workspace."

        let browserButton = NSButton(title: "Browser", target: self, action: #selector(openWebWorkspaceInBrowserFromMenu(_:)))
        browserButton.bezelStyle = .rounded
        browserButton.toolTip = hostSettings.webWorkspaceURL ?? "Open web workspace in the browser"

        let stack = NSStackView(views: [selector, browserButton])
        stack.orientation = .horizontal
        stack.alignment = .centerY
        stack.spacing = 8
        stack.edgeInsets = NSEdgeInsets(top: 0, left: 10, bottom: 0, right: 8)

        controller.view = stack
        window.addTitlebarAccessoryViewController(controller)
        surfaceAccessoryController = controller
        surfaceSelector = selector
        browserSurfaceButton = browserButton
        refreshSurfaceAccessory()
    }

    private func refreshSurfaceAccessory() {
        surfaceSelector?.selectedSegment = currentSurface == .web ? 1 : 0
        browserSurfaceButton?.toolTip = hostSettings.webWorkspaceURL ?? "Open web workspace in the browser"
    }

    private func cancelWebLoadWatchdog() {
        webLoadTimeoutWorkItem?.cancel()
        webLoadTimeoutWorkItem = nil
    }

    private func scheduleWebLoadWatchdog(for url: URL) {
        cancelWebLoadWatchdog()
        let timeoutWorkItem = DispatchWorkItem { [weak self] in
            guard let self, self.currentSurface == .web else {
                return
            }
            let visibleURL = self.webView?.url?.absoluteString ?? url.absoluteString
            self.lastWebSurfaceError = "Embedded web workspace timed out while loading \(visibleURL)"
            self.bridge.noteHostEvent("web workspace timed out; returning to native control center")
            self.currentSurface = .native
            if !self.launchNativeSurface(activate: true) {
                self.loadNativeControlCenterFallback()
                self.showHostWindow()
            }
            self.updateStatusMenu()
            self.refreshSurfaceAccessory()
        }
        webLoadTimeoutWorkItem = timeoutWorkItem
        DispatchQueue.main.asyncAfter(deadline: .now() + 18, execute: timeoutWorkItem)
    }

    private func updateStatusMenu() {
        guard let statusItem else {
            return
        }
        let menu = NSMenu()

        let titleItem = NSMenuItem(title: "猫爪 maoclaw", action: nil, keyEquivalent: "")
        titleItem.isEnabled = false
        menu.addItem(titleItem)
        menu.addItem(.separator())

        let showItem = NSMenuItem(title: "Show Window", action: #selector(showWindowFromMenu(_:)), keyEquivalent: "")
        showItem.target = self
        menu.addItem(showItem)

        let nativeItem = NSMenuItem(title: "Open Native Control Center", action: #selector(openNativeControlCenterFromMenu(_:)), keyEquivalent: "")
        nativeItem.target = self
        nativeItem.state = currentSurface == .native ? .on : .off
        menu.addItem(nativeItem)

        let webItem = NSMenuItem(title: "Open Web Workspace", action: #selector(openWebWorkspaceFromMenu(_:)), keyEquivalent: "")
        webItem.target = self
        webItem.state = currentSurface == .web ? .on : .off
        menu.addItem(webItem)

        let browserItem = NSMenuItem(title: "Open Web Workspace in Browser", action: #selector(openWebWorkspaceInBrowserFromMenu(_:)), keyEquivalent: "")
        browserItem.target = self
        menu.addItem(browserItem)

        menu.addItem(.separator())

        let backgroundTitle = closeBehavior() == .background ? "Close Keeps Running" : "Close Quits App"
        let backgroundItem = NSMenuItem(title: backgroundTitle, action: #selector(toggleBackgroundBehaviorFromMenu(_:)), keyEquivalent: "")
        backgroundItem.target = self
        menu.addItem(backgroundItem)

        menu.addItem(.separator())

        let quitItem = NSMenuItem(title: "Quit maoclaw", action: #selector(quitFromMenu(_:)), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        statusItem.menu = menu
    }

    private func closeBehavior() -> CloseBehavior {
        CloseBehavior(rawValue: hostSettings.closeBehavior ?? "background") ?? .background
    }

    private func showWindow() {
        if currentSurface == .native {
            if launchNativeSurface(activate: true) {
                return
            }
        }
        showHostWindow()
    }

    private func showHostWindow() {
        guard let window else {
            return
        }
        NSApp.unhide(nil)
        window.makeKeyAndOrderFront(nil)
        window.makeMain()
        window.orderFrontRegardless()
        if #available(macOS 14.0, *) {
            NSRunningApplication.current.activate(options: [.activateAllWindows])
        } else {
            NSRunningApplication.current.activate(options: [.activateAllWindows, .activateIgnoringOtherApps])
        }
    }

    private func hideToBackground() {
        window?.orderOut(nil)
        bridge.noteHostEvent("window hidden to background; status item remains available")
    }

    private func handleSaveHostSettings(requestId: String?, payload: [String: Any]) {
        do {
            let bootstrap = try bridge.saveHostSettings(payload: payload)
            hostSettings = bridge.currentHostSettings()
            configureStatusItem()
            refreshSurfaceAccessory()
            bridge.respondToFrontend(requestId: requestId, ok: true, payload: bootstrap)
        } catch {
            bridge.respondToFrontend(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleSwitchDesktopSurface(requestId: String?, payload: [String: Any]) {
        let mode = DesktopSurfaceMode(storageValue: String(describing: payload["mode"] ?? "native"))
        let makePreferred = (payload["makePreferred"] as? Bool) ?? false

        if makePreferred {
            saveHostSettings([
                "preferredSurface": mode.rawValue,
                "webWorkspaceURL": hostSettings.webWorkspaceURL ?? "https://xinxiang.xin",
                "closeBehavior": hostSettings.closeBehavior ?? "background",
                "menuBarEnabled": hostSettings.menuBarEnabled ?? true
            ])
        }

        loadSurface(mode, activate: true)
        bridge.respondToFrontend(requestId: requestId, ok: true, payload: ["surface": mode.rawValue])
    }

    private func handleOpenWebWorkspaceExternal(requestId: String?) {
        openWebWorkspaceExternally()
        bridge.respondToFrontend(requestId: requestId, ok: true, payload: ["url": hostSettings.webWorkspaceURL ?? "https://xinxiang.xin"])
    }

    private func saveHostSettings(_ payload: [String: Any]) {
        do {
            _ = try bridge.saveHostSettings(payload: payload)
            hostSettings = bridge.currentHostSettings()
            configureStatusItem()
            refreshSurfaceAccessory()
        } catch {
            bridge.noteHostEvent("failed to persist host settings: \(error.localizedDescription)")
        }
    }

    private func loadSurface(_ mode: DesktopSurfaceMode, activate: Bool) {
        currentSurface = mode
        bridge.prewarmForSurface(mode.rawValue)
        switch mode {
        case .native:
            cancelWebLoadWatchdog()
            if !launchNativeSurface(activate: activate) {
                loadNativeControlCenterFallback()
                if activate {
                    showHostWindow()
                }
            }
        case .web:
            bridge.stopNativeShell()
            if !loadEmbeddedWebWorkspace() {
                bridge.noteHostEvent("web workspace URL was invalid; falling back to native control center")
                currentSurface = .native
                if !launchNativeSurface(activate: activate) {
                    loadNativeControlCenterFallback()
                    if activate {
                        showHostWindow()
                    }
                }
            } else if activate {
                showHostWindow()
            }
        }
        updateStatusMenu()
        refreshSurfaceAccessory()
    }

    private func launchNativeSurface(activate: Bool) -> Bool {
        let launched = bridge.launchNativeShell(activate: activate)
        if launched {
            lastWebSurfaceError = nil
            window?.orderOut(nil)
        }
        return launched
    }

    private func loadNativeControlCenterFallback() {
        cancelWebLoadWatchdog()
        guard
            let webView,
            let indexURL = Bundle.main.resourceURL?
                .appendingPathComponent("ui", isDirectory: true)
                .appendingPathComponent("index.html")
        else {
            return
        }
        bridge.noteHostEvent("using bundled fallback control center inside the host window")
        webView.loadFileURL(indexURL, allowingReadAccessTo: indexURL.deletingLastPathComponent())
    }

    private func loadEmbeddedWebWorkspace() -> Bool {
        guard
            let webView,
            let raw = hostSettings.webWorkspaceURL,
            let components = URLComponents(string: raw),
            let scheme = components.scheme?.lowercased(),
            ["https", "http"].contains(scheme),
            let url = components.url
        else {
            lastWebSurfaceError = "Configured web workspace URL is invalid."
            return false
        }
        lastWebSurfaceError = nil
        scheduleWebLoadWatchdog(for: url)
        webView.load(URLRequest(url: url))
        return true
    }

    private func openWebWorkspaceExternally() {
        guard let raw = hostSettings.webWorkspaceURL, let url = URL(string: raw) else {
            bridge.noteHostEvent("web workspace URL is invalid and could not be opened externally")
            return
        }
        bridge.prewarmForSurface("web")
        NSWorkspace.shared.open(url)
    }

    private func handleNavigationFailure(_ error: Error) {
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
            bridge.noteWebEvent("navigation cancelled \(webView?.url?.absoluteString ?? "")")
            return
        }
        cancelWebLoadWatchdog()
        lastWebSurfaceError = error.localizedDescription
        bridge.noteWebEvent("navigation failed: \(error.localizedDescription)")
        if currentSurface == .web {
            bridge.noteHostEvent("web workspace load failed; returning to native control center")
            currentSurface = .native
            if !launchNativeSurface(activate: true) {
                loadNativeControlCenterFallback()
                showHostWindow()
            }
            updateStatusMenu()
            refreshSurfaceAccessory()
        }
    }

    private func consoleBridgeScript() -> String {
        """
        (() => {
          const post = (level, parts) => {
            try {
              const text = parts.map((part) => {
                if (typeof part === "string") return part;
                if (part instanceof Error) return part.stack || part.message || String(part);
                if (part && typeof part === "object") {
                  if (typeof part.message === "string" && part.message) {
                    const stack = typeof part.stack === "string" ? `\\n${part.stack}` : "";
                    return `${part.message}${stack}`;
                  }
                  if (typeof part.reason === "string") return part.reason;
                }
                try { return JSON.stringify(part); } catch (_) { return String(part); }
              }).join(" ");
              window.webkit?.messageHandlers?.piConsole?.postMessage({ level, message: text });
            } catch (_) {}
          };

          ["log", "warn", "error"].forEach((level) => {
            const original = console[level];
            console[level] = (...args) => {
              post(level, args);
              original.apply(console, args);
            };
          });

          window.addEventListener("error", (event) => {
            post("error", [event.message || "window error"]);
          });

          window.addEventListener("unhandledrejection", (event) => {
            post("error", [event.reason || "unhandled rejection"]);
          });
        })();
        """
    }
}
