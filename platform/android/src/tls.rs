//! Initialize the process-wide verifier before any reqwest/JMAP networking.

use jni_verifier::{JavaVM, errors::Error, objects::JObject};

/// # Safety
/// `vm` must be the live process JVM and `activity` a live JNI reference to an
/// Android Context. Both must remain valid until this call returns.
pub(super) unsafe fn initialize(
    vm: *mut jni_verifier::sys::JavaVM,
    activity: jni_verifier::sys::jobject,
) -> Result<(), Error> {
    // SAFETY: android_main supplies the live VM and NativeActivity global
    // reference owned by AndroidApp, which outlives this call.
    let vm = unsafe { JavaVM::from_raw(vm) };
    vm.attach_current_thread(|env| {
        // Borrow AndroidApp's global reference without taking ownership.
        let activity = unsafe { env.as_cast_raw::<JObject>(&activity)? };
        // Keep the Application, not an Activity, alive for the process-wide
        // verifier. This also supplies the app class loader for its JVM bridge.
        let context = env
            .call_method(
                &activity,
                jni_verifier::jni_str!(jni = jni_verifier, "getApplicationContext"),
                jni_verifier::jni_sig!(jni = jni_verifier, () -> android.content.Context),
                &[],
            )?
            .l()?;
        rustls_platform_verifier::android::init_with_env(env, context)
    })
}
