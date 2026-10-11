//! Screenshots of the integrated window frame on each desktop platform.
//!
//! `scripts/generate-screenshots.sh` runs this ignored test with
//! `FLECTAR_FRAMELESS_SCREENSHOTS` set to the output directory. The real
//! application window is rendered offscreen with demo mail, so the images
//! follow the shipping layout. macOS keeps AppKit's native traffic lights,
//! which an offscreen renderer cannot draw; they are painted in the macOS
//! Tahoe style at the position the application moves them to.
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

/// Paint one traffic light with antialiasing: the fill, a soft highlight on
/// the upper half for the Tahoe glass finish, and a hairline rim.
fn paint_traffic_light(pixels: &mut [Rgb8Pixel], width: usize, center: (f32, f32), fill: [u8; 3]) {
    let radius = 7.0 * SCALE;
    let (cx, cy) = center;
    let x0 = (cx - radius - 2.0).floor().max(0.0) as usize;
    let y0 = (cy - radius - 2.0).floor().max(0.0) as usize;
    let x1 = (cx + radius + 2.0).ceil() as usize;
    let y1 = (cy + radius + 2.0).ceil() as usize;
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
                        if distance > radius - 0.5 * SCALE {
                            rim += 1.0;
                        }
                    }
                }
            }
            if inside == 0.0 {
                continue;
            }
            let total = (SAMPLES * SAMPLES) as f32;
            let coverage = inside / total;
            let rim = rim / inside;
            // Lighter towards the top, as the glass finish catches light.
            let vertical = ((y as f32 - (cy - radius)) / (2.0 * radius)).clamp(0.0, 1.0);
            let highlight = (1.0 - vertical) * 0.16;
            let shade = |channel: u8| {
                let lit = f32::from(channel) + (255.0 - f32::from(channel)) * highlight;
                lit * (1.0 - rim * 0.18)
            };
            let pixel = &mut pixels[y * width + x];
            let blend = |base: u8, top: f32| {
                (f32::from(base) * (1.0 - coverage) + top * coverage).round() as u8
            };
            pixel.r = blend(pixel.r, shade(fill[0]));
            pixel.g = blend(pixel.g, shade(fill[1]));
            pixel.b = blend(pixel.b, shade(fill[2]));
        }
    }
}

fn paint_traffic_lights(app: &AppWindow, pixels: &mut [Rgb8Pixel], width: usize) {
    let chrome = app.global::<WindowChrome>();
    let x = chrome.get_traffic_light_x();
    let spacing = chrome.get_traffic_light_spacing();
    let center_y = chrome.get_band_height() / 2.0;
    for (index, fill) in [[0xff, 0x5f, 0x57], [0xfe, 0xbc, 0x2e], [0x28, 0xc8, 0x40]]
        .into_iter()
        .enumerate()
    {
        let center_x = x + index as f32 * spacing + 7.0;
        paint_traffic_light(
            pixels,
            width,
            (center_x * SCALE, center_y * SCALE),
            fill,
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
    app.window().dispatch_event(WindowEvent::ScaleFactorChanged {
        scale_factor: SCALE,
    });
    app.set_startup_ready(true);
    app.set_startup_hydrated(true);
    app.set_connected_accounts(ModelRc::new(VecModel::from(vec![AccountRow {
        id: 1,
        name: "Northstar Work".into(),
        email: "alex@northstar.example".into(),
        ..Default::default()
    }])));
    app.set_active_view("mail".into());
    app.show().unwrap();

    let runtime = Rc::new(
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap(),
    );
    let dir = tempfile::tempdir().unwrap();
    let (favicons, _) = bounded_ui_channel();
    let (avatars, _) = bounded_ui_channel();
    let mut state = InboxState::empty(
        None,
        UiSender::new(favicons, UiWake::new(app.as_weak(), |_| {})),
        None,
        UiSender::new(avatars, UiWake::new(app.as_weak(), |_| {})),
        false,
        false,
        WarmStartCacheWriter::spawn(&runtime, dir.path().join("warm.json")),
    );
    state.messages = mail::fixture_messages();
    for (index, message) in state.messages.iter_mut().enumerate() {
        message.folder = "Inbox".into();
        message.thread_id = Some(index as i64 + 1);
        message.body_pending = false;
        message.html = Some(format!(
            "<body style='margin:0;padding:24px;font-family:sans-serif;line-height:1.5'>\
             <h2 style='margin-top:0'>{}</h2><p>Hi Alex,</p>\
             <p>{}</p><p>The new layout keeps the tabs and window controls in one bar \
             above the product rail, so the rest of the window is content.</p>\
             <p>Thanks,<br>{}</p></body>",
            message.subject, message.preview, message.sender
        ));
    }
    // The sidebar shows the connected demo account's folders.
    let account = state.messages[0].account.clone();
    let account_messages = state
        .messages
        .iter()
        .filter(|message| message.account == account)
        .cloned()
        .collect::<Vec<_>>();
    state.mailboxes = fixture_mailboxes(&account_messages);
    let renderer = state.email_renderer.clone();
    renderer
        .borrow_mut()
        .configure_resources(runtime.handle().clone(), false)
        .unwrap();
    app.set_emails(state.email_rows.clone().into());
    app.set_mail_list_entries(Rc::clone(&state.mail_list_entries).into());
    app.set_sidebar_rows(Rc::clone(&state.sidebar_rows).into());
    let state = Rc::new(RefCell::new(state));
    render_current(&app, &state, &runtime).unwrap();

    let subject = |index: usize| {
        state
            .borrow()
            .messages
            .get(index)
            .map(|message| message.subject.clone())
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
                title: subject(1).into(),
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
        let mut pixels =
            vec![Rgb8Pixel::default(); (physical_width * physical_height) as usize];
        // Settle layout, transitions and the message frame for the theme.
        for _ in 0..3 {
            slint::platform::update_timers_and_animations();
            std::thread::sleep(std::time::Duration::from_millis(300));
            slint::platform::update_timers_and_animations();
            renderer
                .borrow_mut()
                .set_appearance(message_appearance::EmailAppearance::from_app(&app));
            app.window().request_redraw();
            window.draw_if_needed(|r| {
                r.render(&mut pixels, physical_width as usize);
            });
            let (w, h) = email_viewport_size(&app);
            if let Some(frame) = renderer
                .borrow_mut()
                .render_cpu_if_needed(w, h, SCALE)
                .unwrap()
            {
                apply_cpu_frame(&app, frame);
            }
            sync_reader_metadata(&app, &renderer);
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
        draw(&format!("settings-frameless-toggle-{suffix}"), WIDTH, HEIGHT);
        app.set_settings_tab("Services".into());
        draw(&format!("settings-services-{suffix}"), WIDTH, HEIGHT);
    }
}
