//! Screenshots of the integrated window frame on each desktop platform.
//!
//! `scripts/generate-screenshots.sh` runs this ignored test with
//! `FLECTAR_FRAMELESS_SCREENSHOTS` set to the output directory. The real
//! application window loads the same prepared Cloudflare fixture as the normal
//! screenshots and is rendered offscreen, so the images
//! follow the shipping layout. macOS keeps AppKit's native traffic lights,
//! which an offscreen renderer cannot draw; `screenshot_traffic_lights` paints
//! them at macOS 26's size and spacing, where the application moves them to.
use super::*;
use slint::Rgb8Pixel;
use slint::platform::{
    Platform, WindowAdapter, WindowEvent,
    software_renderer::{MinimalSoftwareWindow, RepaintBufferType},
};

const SCALE: f32 = 2.0;
const WIDTH: u32 = 1320;
const HEIGHT: u32 = 800;

struct Headless(Rc<MinimalSoftwareWindow>);
impl Platform for Headless {
    fn create_window_adapter(&self) -> Result<Rc<dyn WindowAdapter>, slint::PlatformError> {
        Ok(self.0.clone())
    }
}

/// Paint the lights where the application places the native buttons, using
/// the macOS 26 metrics `WindowChrome` defaults to.
fn paint_traffic_lights(app: &AppWindow, image: &mut image::RgbImage) {
    let chrome = app.global::<WindowChrome>();
    screenshot_traffic_lights::paint(
        image,
        SCALE,
        &screenshot_traffic_lights::Metrics {
            x: chrome.get_traffic_light_x(),
            spacing: chrome.get_traffic_light_spacing(),
            size: chrome.get_traffic_light_size(),
            center_y: chrome.get_band_height() / 2.0,
        },
    );
}

#[test]
#[ignore = "writes screenshots; run by scripts/generate-screenshots.sh"]
fn frameless_screenshots() {
    let Some(out) = std::env::var_os("FLECTAR_FRAMELESS_SCREENSHOTS").map(std::path::PathBuf::from)
    else {
        panic!("set FLECTAR_FRAMELESS_SCREENSHOTS to the output directory");
    };
    std::fs::create_dir_all(&out).unwrap();

    let window = MinimalSoftwareWindow::new(RepaintBufferType::NewBuffer);
    slint::platform::set_platform(Box::new(Headless(window.clone()))).unwrap();
    let app = AppWindow::new().unwrap();
    app.window()
        .dispatch_event(WindowEvent::ScaleFactorChanged {
            scale_factor: SCALE,
        });
    screenshot_fixture::apply(&app);
    app.show().unwrap();

    let subject = |index: usize| {
        app.get_emails()
            .row_data(index)
            .map(|row| row.subject)
            .unwrap_or_default()
    };
    app.global::<TabsUi>()
        .set_rows(ModelRc::new(VecModel::from(vec![
            TabRow {
                id: 1,
                workspace: "mail".into(),
                title: "".into(),
                active: true,
            },
            TabRow {
                id: 2,
                workspace: "mail".into(),
                title: subject(1),
                active: false,
            },
            TabRow {
                id: 3,
                workspace: "calendar".into(),
                title: "".into(),
                active: false,
            },
        ])));

    let draw = |name: &str, width: u32, height: u32| {
        let (physical_width, physical_height) = (
            (width as f32 * SCALE) as u32,
            (height as f32 * SCALE) as u32,
        );
        app.window()
            .set_size(slint::PhysicalSize::new(physical_width, physical_height));
        let mut pixels = vec![Rgb8Pixel::default(); (physical_width * physical_height) as usize];
        // Settle layout, transitions and the message frame for the theme.
        for _ in 0..3 {
            slint::platform::update_timers_and_animations();
            std::thread::sleep(std::time::Duration::from_millis(300));
            slint::platform::update_timers_and_animations();
            app.window().request_redraw();
            window.draw_if_needed(|r| {
                r.render(&mut pixels, physical_width as usize);
            });
        }
        app.window().request_redraw();
        window.draw_if_needed(|r| {
            r.render(&mut pixels, physical_width as usize);
        });
        let bytes: Vec<u8> = pixels.iter().flat_map(|p| [p.r, p.g, p.b]).collect();
        let mut image = image::RgbImage::from_raw(physical_width, physical_height, bytes).unwrap();
        let chrome = app.global::<WindowChrome>();
        if chrome.get_platform() == "macos" && chrome.get_controls_visible() {
            paint_traffic_lights(&app, &mut image);
        }
        image.save(out.join(format!("{name}.png"))).unwrap();
    };
    let chrome = app.global::<WindowChrome>();
    let controls = |names: &[&str]| {
        ModelRc::new(VecModel::from(
            names
                .iter()
                .map(|name| slint::SharedString::from(*name))
                .collect::<Vec<_>>(),
        ))
    };
    let linux = |style: &str, leading: &[&str], trailing: &[&str]| {
        chrome.set_platform("linux".into());
        chrome.set_linux_style(style.into());
        chrome.set_leading_controls(controls(leading));
        chrome.set_trailing_controls(controls(trailing));
    };
    let gtk_default = ["minimize", "maximize", "close"];
    let themes = [("light", "light"), ("dark", "dark")];

    chrome.set_platform("linux".into());
    chrome.set_preference("system".into());
    chrome.set_integrated(false);
    for (mode, suffix) in themes {
        app.set_theme_mode(mode.into());
        draw(&format!("system-frame-{suffix}"), WIDTH, HEIGHT);
    }

    chrome.set_preference("integrated".into());
    chrome.set_integrated(true);
    for (mode, suffix) in themes {
        app.set_theme_mode(mode.into());
        linux("adwaita", &[], &gtk_default);
        draw(&format!("linux-gnome-{suffix}"), WIDTH, HEIGHT);
        linux("breeze", &[], &gtk_default);
        draw(&format!("linux-kde-{suffix}"), WIDTH, HEIGHT);
        linux("adwaita", &["close", "minimize", "maximize"], &[]);
        draw(&format!("linux-buttons-left-{suffix}"), WIDTH, HEIGHT);
        chrome.set_platform("windows".into());
        draw(&format!("windows-{suffix}"), WIDTH, HEIGHT);
        chrome.set_platform("macos".into());
        draw(&format!("macos-{suffix}"), WIDTH, HEIGHT);
    }

    app.set_theme_mode("light".into());
    chrome.set_platform("windows".into());
    chrome.set_hovered_control("close".into());
    draw("windows-close-hover-light", WIDTH, HEIGHT);
    chrome.set_hovered_control("".into());

    linux("adwaita", &[], &gtk_default);
    draw("linux-compact-light", 900, 760);

    app.set_settings_open(true);
    for (mode, suffix) in themes {
        app.set_theme_mode(mode.into());
        app.set_settings_tab("General".into());
        draw(
            &format!("settings-frameless-toggle-{suffix}"),
            WIDTH,
            HEIGHT,
        );
        app.set_settings_tab("Services".into());
        draw(&format!("settings-services-{suffix}"), WIDTH, HEIGHT);
    }
}
