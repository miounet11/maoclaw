use std::{env, fs, path::PathBuf};

use vergen_gix::{BuildBuilder, CargoBuilder, Emitter, GixBuilder, RustcBuilder};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let out_dir = PathBuf::from(env::var("OUT_DIR")?);
    let legacy_models_source =
        PathBuf::from("legacy_pi_mono_code/pi-mono/packages/ai/src/models.generated.ts");
    let legacy_models_out = out_dir.join("legacy_models_generated.ts");
    let legacy_models =
        fs::read_to_string(&legacy_models_source).unwrap_or_else(|_| String::from("// stub\n"));
    fs::write(&legacy_models_out, legacy_models)?;

    println!("cargo:rerun-if-changed={}", legacy_models_source.display());

    let build = BuildBuilder::default().build_timestamp(true).build()?;
    let cargo = CargoBuilder::default().target_triple(true).build()?;
    let rustc = RustcBuilder::default().semver(true).build()?;

    let mut emitter = Emitter::default();
    // Offloaded builds can temporarily miss git objects and trigger fallback warnings.
    // Keep default env fallbacks, but suppress warning noise in build output.
    emitter
        .quiet()
        .add_instructions(&build)?
        .add_instructions(&cargo)?
        .add_instructions(&rustc)?;

    // Git metadata is nice-to-have for release provenance, but CI packaging must
    // still succeed when the checkout shape or git safety rules make vergen-gix
    // unable to inspect the repository.
    match GixBuilder::default().sha(true).dirty(true).build() {
        Ok(gix) => {
            if let Err(err) = emitter.add_instructions(&gix) {
                println!("cargo:warning=git metadata unavailable: {err}");
            }
        }
        Err(err) => {
            println!("cargo:warning=git metadata unavailable: {err}");
        }
    }

    emitter.emit()?;

    Ok(())
}
