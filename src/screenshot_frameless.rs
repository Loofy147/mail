//! Screenshots of the integrated window frame on each desktop platform.
//!
//! `scripts/generate-screenshots.sh` runs this ignored test with
//! `FLECTAR_FRAMELESS_SCREENSHOTS` set to the output directory. The real
//! application window loads the same prepared Cloudflare fixture as the normal
//! screenshots and is rendered offscreen, so the images
//! follow the shipping layout. macOS keeps AppKit's native traffic lights,
//! which an offscreen renderer cannot draw; they are painted in the standard
//! macOS colours at macOS 26's size and spacing, where the application moves
//! them to.
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

/// The standard macOS window-control colours: each light's fill and the
/// slightly darker rim AppKit draws around it.
struct TrafficLight {
    fill: [u8; 3],
    rim: [u8; 3],
}

const TRAFFIC_LIGHTS: [TrafficLight; 3] = [
    TrafficLight {
        fill: [0xff, 0x5f, 0x57],
        rim: [0xe0, 0x44, 0x3e],
    },
    TrafficLight {
        fill: [0xfe, 0xbc, 0x2e],
        rim: [0xde, 0xa1, 0x23],
    },
    TrafficLight {
        fill: [0x28, 0xc8, 0x40],
        rim: [0x1a, 0xab, 0x29],
    },
];

/// Paint one antialiased light of `diameter` (physical pixels) with a
/// hairline rim.
fn paint_traffic_light(
    pixels: &mut [Rgb8Pixel],
    width: usize,
    center: (f32, f32),
    diameter: f32,
    light: &TrafficLight,
) {
    let radius = diameter / 2.0;
    let rim_width = 0.5 * SCALE;
    let (cx, cy) = center;
    let x0 = (cx - radius - 1.0).floor().max(0.0) as usize;
    let y0 = (cy - radius - 1.0).floor().max(0.0) as usize;
    let x1 = (cx + radius + 1.0).ceil() as usize;
    let y1 = (cy + radius + 1.0).ceil() as usize;
    const SAMPLES: usize = 4;
    for y in y0..y1 {
        for x in x0..x1 {
            let mut inside = 0.0;
            let mut rim = 0.0;
            for sy in 0..SAMPLES {
                for sx in 0..SAMPLES {
                    let px = x as f32 + (sx as f32 + 0.5) / SAMPLES as f32 - cx;
                    let py = y as f32 + (sy as f32 + 0.5) / SAMPLES as f32 - cy;
                    let distance = (px * px + py * py).sqrt();
                    if distance <= radius {
                        inside += 1.0;
                        if distance > radius - rim_width {
                            rim += 1.0;
                        }
                    }
                }
            }
            if inside == 0.0 {
                continue;
            }
            let coverage = inside / (SAMPLES * SAMPLES) as f32;
            let rim = rim / inside;
            let shade = |channel: usize| {
                let fill = f32::from(light.fill[channel]);
                fill + (f32::from(light.rim[channel]) - fill) * rim
            };
            let pixel = &mut pixels[y * width + x];
            let blend = |base: u8, color: f32| {
                (f32::from(base) * (1.0 - coverage) + color * coverage).round() as u8
            };
            pixel.r = blend(pixel.r, shade(0));
            pixel.g = blend(pixel.g, shade(1));
            pixel.b = blend(pixel.b, shade(2));
        }
    }
}

/// Paint the lights where the application places the native buttons, using
/// the macOS 26 metrics `WindowChrome` defaults to.
fn paint_traffic_lights(app: &AppWindow, pixels: &mut [Rgb8Pixel], width: usize) {
    let chrome = app.global::<WindowChrome>();
    let x = chrome.get_traffic_light_x();
    let spacing = chrome.get_traffic_light_spacing();
    let size = chrome.get_traffic_light_size();
    let center_y = chrome.get_band_height() / 2.0;
    for (index, light) in TRAFFIC_LIGHTS.iter().enumerate() {
        let center_x = x + index as f32 * spacing + size / 2.0;
        paint_traffic_light(
            pixels,
            width,
            (center_x * SCALE, center_y * SCALE),
            size * SCALE,
            light,
        );
    }
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
        let chrome = app.global::<WindowChrome>();
        if chrome.get_platform() == "macos" && chrome.get_controls_visible() {
            paint_traffic_lights(&app, &mut pixels, physical_width as usize);
        }
        let bytes: Vec<u8> = pixels.iter().flat_map(|p| [p.r, p.g, p.b]).collect();
        image::save_buffer(
            out.join(format!("{name}.png")),
            &bytes,
            physical_width,
            physical_height,
            image::ColorType::Rgb8,
        )
        .unwrap();
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
