import AppKit

let app = NSApplication.shared
let delegate = PiDesktopApp()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
