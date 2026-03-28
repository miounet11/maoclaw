#![cfg_attr(not(feature = "desktop-iced"), allow(dead_code))]

#[cfg(feature = "desktop-iced")]
fn main() -> iced::Result {
    pi::desktop_iced::run()
}

#[cfg(not(feature = "desktop-iced"))]
fn main() {
    eprintln!("The pi_desktop binary requires compiling with --features desktop-iced");
    std::process::exit(1);
}
