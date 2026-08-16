use std::path::Path;

fn main() {
    println!("cargo:rerun-if-env-changed=LICENSE_PUBLIC_KEY");
    if std::env::var("LICENSE_PUBLIC_KEY")
        .map(|k| !k.trim().is_empty())
        .unwrap_or(false)
    {
        // Environment variable already provided
    } else {
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
        let candidate_paths = [
            Path::new(&manifest_dir).join("../../metalizer-license-keys/public.key"),
            Path::new(&manifest_dir).join("../metalizer-license-keys/public.key"),
            Path::new(&manifest_dir).join("public.key"),
        ];

        for path in &candidate_paths {
            println!("cargo:rerun-if-changed={}", path.display());
            if let Ok(content) = std::fs::read_to_string(path) {
                let trimmed = content.trim();
                if !trimmed.is_empty() {
                    println!("cargo:rustc-env=LICENSE_PUBLIC_KEY={}", trimmed);
                    break;
                }
            }
        }
    }

    tauri_build::build()
}
