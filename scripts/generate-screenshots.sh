#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture="$repo_dir/resources/screenshots/demo-data.json"
ui="$repo_dir/ui/app.slint"
output_dir="$repo_dir/resources/screenshots"
temporary_dir="$(mktemp -d)"
temporary_ui=""
trap 'rm -rf "$temporary_dir"; test -z "$temporary_ui" || rm -f "$temporary_ui"' EXIT

command -v slint-viewer >/dev/null 2>&1 || {
  echo "slint-viewer 1.18+ is required" >&2
  exit 1
}
command -v cargo >/dev/null 2>&1 || {
  echo "Cargo is required to generate sender favicons" >&2
  exit 1
}
command -v jq >/dev/null 2>&1 || {
  echo "jq is required to prepare screenshot fixtures" >&2
  exit 1
}

slint-viewer --check "$ui"

demo_email_svg="$output_dir/demo-email.svg"
demo_email_png="$temporary_dir/demo-email.png"
demo_email_ui="$temporary_dir/demo-email.slint"
ln -s "$demo_email_svg" "$temporary_dir/demo-email.svg"
cat > "$demo_email_ui" <<'EOF'
export component DemoEmail inherits Window {
    preferred-width: 720px;
    preferred-height: 760px;

    Image {
        width: 100%;
        height: 100%;
        source: @image-url("demo-email.svg");
        image-fit: fill;
    }
}
EOF
SLINT_SCALE_FACTOR=2 slint-viewer \
  --style fluent \
  --screenshot "$demo_email_png" \
  "$demo_email_ui"

favicon_dir="$temporary_dir/favicons"
mapfile -t sender_addresses < <(
  jq -r '[.selected_address, (.emails[].address), (.thread_messages[]? | select(.outgoing | not) | .address)] | unique[]' "$fixture"
)
cargo run --quiet --example generate-screenshot-favicons -- \
  "$favicon_dir" "${sender_addresses[@]}"

prepare_data() {
  local output_name="$1"
  local width="$2"
  local height="$3"
  local theme="$4"
  local workspace_layout="${5:-default}"
  local theme_preset="${6:-default}"
  local active_view="${7:-mail}"
  local show_threads="${8:-false}"
  local show_account_markers="${9:-false}"
  local settings_tab="${10:-}"
  local calendar_mode="${11:-week}"
  local data_file="$temporary_dir/$output_name.json"

  jq \
    --arg theme "$theme" \
    --arg workspace_layout "$workspace_layout" \
    --arg theme_preset "$theme_preset" \
    --arg active_view "$active_view" \
    --arg calendar_mode "$calendar_mode" \
    --arg settings_tab "$settings_tab" \
    --arg favicon_dir "$favicon_dir" \
    --arg demo_email "$demo_email_png" \
    --argjson show_threads "$show_threads" \
    --argjson show_account_markers "$show_account_markers" \
    -f "$repo_dir/scripts/prepare-screenshot-data.jq" "$fixture" > "$data_file"

}

render() {
  local output_name="$1"
  local width="$2"
  local height="$3"
  local theme="$4"
  local theme_preset="${6:-default}"
  local style="fluent"
  local data_file="$temporary_dir/$output_name.json"
  local email_tiles
  [[ "$theme" != "dark" ]] || style="fluent-dark"
  temporary_ui="$(mktemp "$repo_dir/ui/.screenshot-app.XXXXXX.slint")"
  prepare_data "$@"

  # Compile the body images into the preview. Runtime image properties can
  # still be empty when the headless viewer takes its first snapshot.
  email_tiles="$(jq -r '
    [.email_tiles[] | "{image: @image-url(" + (.image | tojson)
      + "), y: " + (.y | tostring) + ", height: " + (.height | tostring) + "}"]
    | "[" + join(", ") + "]"
  ' "$data_file")"
  jq 'del(.email_tiles)' "$data_file" > "$data_file.tmp"
  mv "$data_file.tmp" "$data_file"

  sed \
    -e "s|in property <\[EmailTile\]> email_tiles: \[\];|in property <[EmailTile]> email_tiles: ${email_tiles};|" \
    -e "s/preferred-width: 1320px/preferred-width: ${width}px/" \
    -e "s/preferred-height: 800px/preferred-height: ${height}px/" \
    -e "s/in-out property <string> theme_mode: \"system\";/in-out property <string> theme_mode: \"${theme}\";\n    in-out property <string> screenshot_theme_preset: \"${theme_preset}\";/" \
    -e 's/    changed theme-mode => {/    init => {\n        AppTheme.preset = root.screenshot-theme-preset;\n        Palette.color-scheme = root.theme-mode == "dark" ? ColorScheme.dark\n            : root.theme-mode == "light" ? ColorScheme.light\n            : ColorScheme.unknown;\n    }\n\n    changed screenshot-theme-preset => { AppTheme.preset = root.screenshot-theme-preset; }\n\n    changed theme-mode => {/' \
    "$ui" > "$temporary_ui"

  echo "Rendering $output_name.png"
  SLINT_SCALE_FACTOR=2 slint-viewer \
    --style "$style" \
    --size "${width}x${height}" \
    --load-data "$data_file" \
    --screenshot "$output_dir/$output_name.png" \
    "$temporary_ui"
  rm -f "$temporary_ui"
  temporary_ui=""
}

# Set SCREENSHOT_ONLY to one or more comma-separated output names when
# refreshing selected assets.
render_selected() {
  local output_name="$1"
  local screenshot_only="${SCREENSHOT_ONLY:-}"
  if [[ -z "$screenshot_only" || ",${screenshot_only}," == *",${output_name},"* ]]; then
    render "$@"
  fi
}

render_selected desktop-light 1320 800 light
render_selected desktop-dark 1320 800 dark
render_selected desktop-profiles-light 1320 800 light default default mail false true
render_selected desktop-profiles-dark 1320 800 dark default default mail false true
render_selected desktop-thread-light 1320 800 light default default mail true
render_selected desktop-thread-dark 1320 800 dark default default mail true
render_selected desktop-minimal-light 1320 800 light minimal
render_selected desktop-minimal-dark 1320 800 dark minimal
render_selected desktop-teal-light 1320 800 light default teal
render_selected desktop-green-light 1320 800 light default green
render_selected desktop-purple-light 1320 800 light default purple
render_selected desktop-teal-dark 1320 800 dark default teal
render_selected desktop-green-dark 1320 800 dark default green
render_selected desktop-purple-dark 1320 800 dark default purple
render_selected desktop-calendar-light 1320 800 light default default calendar
render_selected desktop-calendar-dark 1320 800 dark default default calendar
render_selected desktop-contacts-light 1320 800 light default default contacts
render_selected desktop-contacts-dark 1320 800 dark default default contacts
render_selected desktop-files-light 1320 800 light default default files
render_selected desktop-files-dark 1320 800 dark default default files
render_selected desktop-storage-light 1320 800 light default default mail false false Data
render_selected desktop-storage-dark 1320 800 dark default default mail false false Data
render_selected mobile-light 390 844 light
render_selected mobile-dark 390 844 dark

render_selected desktop-agenda-light 1320 800 light default default calendar false false "" agenda
render_selected desktop-agenda-dark 1320 800 dark default default calendar false false "" agenda
render_selected tablet-agenda-light 768 1024 light default default calendar false false "" agenda
render_selected tablet-agenda-dark 768 1024 dark default default calendar false false "" agenda
render_selected mobile-agenda-light 390 844 light default default calendar false false "" agenda
render_selected mobile-agenda-dark 390 844 dark default default calendar false false "" agenda

# The integrated window frame is rendered from the real application window
# by an ignored test, because each platform's window controls are chosen at
# runtime rather than in the static Slint preview.
if [[ -z "${SCREENSHOT_ONLY:-}" || ",${SCREENSHOT_ONLY}," == *",frameless,"* ]]; then
  echo "Rendering frameless/*.png"
  prepare_data frameless 1320 800 light
  FLECTAR_SCREENSHOT_DATA="$temporary_dir/frameless.json" \
  FLECTAR_FRAMELESS_SCREENSHOTS="$output_dir/frameless" cargo test --quiet --locked \
    -p flectar-mail --lib screenshot_frameless::frameless_screenshots -- --ignored --exact
fi
