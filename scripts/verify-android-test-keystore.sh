#!/usr/bin/env bash
# Check the persistent alpha signing identity before building or publishing.
set -euo pipefail

project_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
keystore="${FLECTAR_ANDROID_TEST_KEYSTORE:-}"
if [[ -z "$keystore" || ! -f "$keystore" ]]; then
  printf 'CI requires an existing FLECTAR_ANDROID_TEST_KEYSTORE. Restore FLECTAR_ANDROID_TEST_KEYSTORE_BASE64; never generate a replacement release key.\n' >&2
  exit 1
fi

expected="$(cat "$project_dir/platform/android/test-signing-certificate.sha256")"
if [[ ! "$expected" =~ ^[0-9a-f]{64}$ ]]; then
  printf 'The pinned Android test signing certificate SHA-256 is invalid.\n' >&2
  exit 1
fi
actual="$(keytool -exportcert -keystore "$keystore" -alias androiddebugkey -storepass android | sha256sum)"
if [[ "${actual%% *}" != "$expected" ]]; then
  printf 'Android test signing key differs from the pinned alpha 8 identity. Restore the original keystore to preserve updates; do not replace the fingerprint.\n' >&2
  exit 1
fi
printf '%s\n' "$expected"
