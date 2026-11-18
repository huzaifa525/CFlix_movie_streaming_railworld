import AppKit
import Network
import WebKit

// Fixed so the page keeps the same origin, and with it My List and
// Continue Watching, between launches
let sitePort: UInt16 = 47811

let logging = ProcessInfo.processInfo.environment["CFLIX_LOG"] != nil

func log(_ message: String) {
    if logging { FileHandle.standardError.write(Data((message + "\n").utf8)) }
}

final class SiteServer {
    private let root: URL
    private let listener: NWListener
    private let queue = DispatchQueue(label: "cflix.site-server")

    init(root: URL, port: UInt16) throws {
        self.root = root.standardizedFileURL
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: port)!)
        parameters.allowLocalEndpointReuse = true
        listener = try NWListener(using: parameters)
    }

    func start(onReady: @escaping () -> Void, onFailure: @escaping (NWError) -> Void) {
        listener.stateUpdateHandler = { state in
            switch state {
            case .ready:
                DispatchQueue.main.async(execute: onReady)
            case .failed(let error):
                DispatchQueue.main.async { onFailure(error) }
            default:
                break
            }
        }
        listener.newConnectionHandler = { [weak self] connection in
            connection.start(queue: self?.queue ?? .main)
            self?.receive(on: connection, buffer: Data())
        }
        listener.start(queue: queue)
    }

    private func receive(on connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, isComplete, error in
            guard let self else { return }
            var request = buffer
            if let data { request.append(data) }

            if request.range(of: Data("\r\n\r\n".utf8)) != nil {
                self.respond(to: request, on: connection)
            } else if isComplete || error != nil || request.count > 65536 {
                connection.cancel()
            } else {
                self.receive(on: connection, buffer: request)
            }
        }
    }

    private func respond(to request: Data, on connection: NWConnection) {
        let line = String(decoding: request.prefix(while: { $0 != 13 }), as: UTF8.self)
        let parts = line.split(separator: " ").map(String.init)
        let method = parts.first ?? ""

        var status = "404 Not Found"
        var type = "text/plain; charset=utf-8"
        var body = Data("Not found".utf8)

        if parts.count >= 2, method == "GET" || method == "HEAD",
           let file = fileURL(for: parts[1]), let data = try? Data(contentsOf: file) {
            status = "200 OK"
            type = contentType(for: file)
            body = data
        }

        log("\(status.prefix(3)) \(parts.count >= 2 ? parts[1] : line)")

        let head = "HTTP/1.1 \(status)\r\nContent-Type: \(type)\r\nContent-Length: \(body.count)\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n"
        var response = Data(head.utf8)
        if method != "HEAD" { response.append(body) }
        connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
    }

    private func fileURL(for target: String) -> URL? {
        let path = String(target.split(separator: "?", maxSplits: 1).first ?? "/")
        guard var decoded = path.removingPercentEncoding else { return nil }
        if decoded.hasSuffix("/") { decoded += "index.html" }

        let file = root.appendingPathComponent(String(decoded.drop(while: { $0 == "/" }))).standardizedFileURL
        // Refuse paths like /../ that would leave the site folder
        guard file.path.hasPrefix(root.path + "/") else { return nil }

        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: file.path, isDirectory: &isDirectory), !isDirectory.boolValue else { return nil }
        return file
    }

    private func contentType(for file: URL) -> String {
        switch file.pathExtension.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "svg": return "image/svg+xml"
        case "ico": return "image/x-icon"
        default: return "application/octet-stream"
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuItemValidation, WKNavigationDelegate, WKUIDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var server: SiteServer?
    private var titleObservation: NSKeyValueObservation?
    private var popupWindows: [WKWebView: NSWindow] = [:]
    private let homeURL = URL(string: "http://127.0.0.1:\(sitePort)/index.html")!

    private var blockAds: Bool {
        get { !UserDefaults.standard.bool(forKey: "allowAds") }
        set { UserDefaults.standard.set(!newValue, forKey: "allowAds") }
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()

        let configuration = WKWebViewConfiguration()
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.preferences.isElementFullscreenEnabled = true
        configuration.applicationNameForUserAgent = "Version/26.0 Safari/605.1.15"

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.underPageBackgroundColor = NSColor(red: 0.08, green: 0.08, blue: 0.08, alpha: 1)

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 800),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "CFlix"
        window.appearance = NSAppearance(named: .darkAqua)
        window.backgroundColor = webView.underPageBackgroundColor
        window.minSize = NSSize(width: 900, height: 600)
        window.collectionBehavior = [.fullScreenPrimary]

        // A plain container that the window resizes, with the page set to
        // follow it, so the page fills the window in full screen too
        let container = NSView(frame: window.contentLayoutRect)
        webView.frame = container.bounds
        webView.autoresizingMask = [.width, .height]
        container.addSubview(webView)
        window.contentView = container
        window.center()
        window.setFrameAutosaveName("CFlixMain")
        window.makeKeyAndOrderFront(nil)

        titleObservation = webView.observe(\.title) { [weak self] webView, _ in
            let title = webView.title ?? ""
            self?.window.title = title.isEmpty ? "CFlix" : title
        }

        applyAdBlocking {
            self.startServer()
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    private func startServer() {
        guard let siteFolder = Bundle.main.resourceURL?.appendingPathComponent("site") else { return }

        do {
            let server = try SiteServer(root: siteFolder, port: sitePort)
            self.server = server
            server.start(onReady: { [weak self] in
                guard let self else { return }
                self.webView.load(URLRequest(url: self.homeURL))
            }, onFailure: { error in
                self.showFatalError("CFlix couldn't start because port \(sitePort) is in use. Quit any other copy of CFlix and try again.\n\n\(error)")
            })
        } catch {
            showFatalError("CFlix couldn't start.\n\n\(error)")
        }
    }

    private func showFatalError(_ message: String) {
        let alert = NSAlert()
        alert.messageText = "CFlix couldn't open"
        alert.informativeText = message
        alert.runModal()
        NSApp.terminate(nil)
    }

    // EasyList, EasyPrivacy and CFlix's own rules, converted by mac/build.sh
    private func applyAdBlocking(then done: @escaping () -> Void) {
        let controller = webView.configuration.userContentController
        controller.removeAllContentRuleLists()
        guard blockAds, let store = WKContentRuleListStore.default() else {
            done()
            return
        }

        let folder = Bundle.main.resourceURL?.appendingPathComponent("blocklists")
        let files = ((try? FileManager.default.contentsOfDirectory(at: folder!, includingPropertiesForKeys: nil)) ?? [])
            .filter { $0.pathExtension == "json" }
        let identifiers = Set(files.map { $0.deletingPathExtension().lastPathComponent })
        removeOldRuleLists(from: store, keeping: identifiers)

        let group = DispatchGroup()
        let started = Date()
        for file in files {
            group.enter()
            loadRuleList(from: file, in: store) { list in
                if let list { controller.add(list) }
                group.leave()
            }
        }
        group.notify(queue: .main) {
            log("Ad blocking ready: \(files.count) lists in \(String(format: "%.1f", Date().timeIntervalSince(started)))s")
            done()
        }
    }

    // A list's name includes a hash of its rules, so a rebuilt app with new
    // rules compiles them once and reuses them on later launches
    private func loadRuleList(from file: URL, in store: WKContentRuleListStore, completion: @escaping (WKContentRuleList?) -> Void) {
        let identifier = file.deletingPathExtension().lastPathComponent

        store.lookUpContentRuleList(forIdentifier: identifier) { cached, _ in
            if let cached {
                DispatchQueue.main.async { completion(cached) }
                return
            }

            guard let json = try? String(contentsOf: file, encoding: .utf8) else {
                DispatchQueue.main.async { completion(nil) }
                return
            }

            store.compileContentRuleList(forIdentifier: identifier, encodedContentRuleList: json) { list, error in
                if let error { log("Couldn't compile \(identifier): \(error)") }
                DispatchQueue.main.async { completion(list) }
            }
        }
    }

    private func removeOldRuleLists(from store: WKContentRuleListStore, keeping identifiers: Set<String>) {
        store.getAvailableContentRuleListIdentifiers { available in
            for identifier in available ?? [] where !identifiers.contains(identifier) {
                store.removeContentRuleList(forIdentifier: identifier) { _ in }
            }
        }
    }

    private func isSiteURL(_ url: URL) -> Bool {
        url.host == "127.0.0.1" && url.port == Int(sitePort)
    }

    // Anything other than CFlix trying to take over the main window is how ad
    // redirects work, so it's dropped. Links the viewer clicked open in their browser.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard navigationAction.targetFrame?.isMainFrame == true, let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        if let popupWindow = popupWindows[webView] {
            // Pop-up windows only appear once they load a real page
            if url.scheme != "about" { popupWindow.makeKeyAndOrderFront(nil) }
            decisionHandler(.allow)
            return
        }

        if isSiteURL(url) || url.scheme == "about" {
            decisionHandler(.allow)
            return
        }

        if navigationAction.navigationType == .linkActivated {
            NSWorkspace.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    // Links clicked on CFlix's own pages open in the browser. Other new windows
    // come from the video servers, which refuse to play if pop-ups are blocked,
    // so they open as separate windows the way a normal browser would show them.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if webView === self.webView,
           navigationAction.sourceFrame.isMainFrame,
           let url = navigationAction.request.url,
           url.scheme == "https" || url.scheme == "http" {
            NSWorkspace.shared.open(url)
            return nil
        }

        let popup = WKWebView(frame: NSRect(x: 0, y: 0, width: 1000, height: 700), configuration: configuration)
        popup.navigationDelegate = self
        popup.uiDelegate = self

        let popupWindow = NSWindow(
            contentRect: popup.frame,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        popupWindow.title = "Pop-up"
        popupWindow.contentView = popup
        popupWindow.isReleasedWhenClosed = false
        popupWindow.cascadeTopLeft(from: NSPoint(x: window.frame.minX + 40, y: window.frame.maxY - 40))
        NotificationCenter.default.addObserver(forName: NSWindow.willCloseNotification, object: popupWindow, queue: .main) { [weak self] _ in
            self?.popupWindows[popup] = nil
        }

        popupWindows[popup] = popupWindow
        return popup
    }

    func webViewDidClose(_ webView: WKWebView) {
        popupWindows[webView]?.close()
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    @objc private func goHome(_ sender: Any?) {
        webView.load(URLRequest(url: homeURL))
    }

    @objc private func openSearch(_ sender: Any?) {
        webView.load(URLRequest(url: homeURL.deletingLastPathComponent().appendingPathComponent("search.html")))
    }

    @objc private func toggleAdBlocking(_ sender: Any?) {
        blockAds.toggle()
        applyAdBlocking {
            self.webView.reload()
        }
    }

    func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
        if menuItem.action == #selector(toggleAdBlocking(_:)) {
            menuItem.state = blockAds ? .on : .off
        }
        return true
    }

    private func buildMenu() {
        let mainMenu = NSMenu()

        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About CFlix", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide CFlix", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Quit CFlix", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        addSubmenu(appMenu, titled: "CFlix", to: mainMenu)

        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        addSubmenu(editMenu, titled: "Edit", to: mainMenu)

        let viewMenu = NSMenu(title: "View")
        viewMenu.addItem(withTitle: "Home", action: #selector(goHome(_:)), keyEquivalent: "H").target = self
        viewMenu.addItem(withTitle: "Search", action: #selector(openSearch(_:)), keyEquivalent: "f").target = self
        viewMenu.addItem(.separator())
        viewMenu.addItem(withTitle: "Back", action: #selector(WKWebView.goBack(_:)), keyEquivalent: "[")
        viewMenu.addItem(withTitle: "Forward", action: #selector(WKWebView.goForward(_:)), keyEquivalent: "]")
        viewMenu.addItem(withTitle: "Reload", action: #selector(WKWebView.reload(_:)), keyEquivalent: "r")
        viewMenu.addItem(.separator())
        viewMenu.addItem(withTitle: "Block Ads", action: #selector(toggleAdBlocking(_:)), keyEquivalent: "").target = self
        viewMenu.addItem(.separator())
        let fullScreen = viewMenu.addItem(withTitle: "Enter Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        fullScreen.keyEquivalentModifierMask = [.command, .control]
        addSubmenu(viewMenu, titled: "View", to: mainMenu)

        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(withTitle: "Close Window", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        addSubmenu(windowMenu, titled: "Window", to: mainMenu)
        NSApp.windowsMenu = windowMenu

        NSApp.mainMenu = mainMenu
    }

    private func addSubmenu(_ menu: NSMenu, titled title: String, to mainMenu: NSMenu) {
        let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        item.submenu = menu
        mainMenu.addItem(item)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
