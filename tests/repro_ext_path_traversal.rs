use pi::extensions_js::PiJsRuntime;
use std::fs;
use tempfile::TempDir;

#[test]
fn repro_ext_path_traversal() {
    futures::executor::block_on(async {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path();
        let ext_root = root.join("ext");
        fs::create_dir(&ext_root).unwrap();

        let secret_file = root.join("secret.mjs");
        fs::write(&secret_file, "export const secret = 's3cr3t';").unwrap();

        // The entry module lives inside the extension root but reaches outside it.
        let index_file = ext_root.join("index.mjs");
        fs::write(
            &index_file,
            "import { secret } from '../secret.mjs'; globalThis.secret = secret; export default secret;",
        )
        .unwrap();

        let runtime = PiJsRuntime::new().await.unwrap();

        runtime.add_extension_root(ext_root.clone());

        let entry_spec = format!("file://{}", index_file.display());
        let script = format!(
            r#"
            globalThis.importAttempt = {{}};
            import({entry_spec:?})
              .then(() => {{
                globalThis.importAttempt.done = true;
                globalThis.importAttempt.ok = true;
                globalThis.importAttempt.error = "";
              }})
              .catch((err) => {{
                globalThis.importAttempt.done = true;
                globalThis.importAttempt.ok = false;
                globalThis.importAttempt.error = String((err && err.message) || err || "");
              }})
              .finally(() => {{
                globalThis.importAttempt.secretAssigned =
                  Object.prototype.hasOwnProperty.call(globalThis, "secret");
              }});
            "#
        );
        runtime.eval(&script).await.unwrap();

        let result = runtime.read_global_json("importAttempt").await.unwrap();
        assert_eq!(result["done"], serde_json::json!(true));
        assert_eq!(result["ok"], serde_json::json!(false));
        assert_eq!(result["secretAssigned"], serde_json::json!(false));

        let message = result["error"].as_str().unwrap_or_default();
        assert!(
            message.contains("Unsupported module specifier: ../secret.mjs")
                || message.contains("outside extension root"),
            "Unexpected error message: {message}",
        );
    });
}
