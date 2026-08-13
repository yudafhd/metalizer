use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use zeroize::Zeroizing;

pub struct AppState {
    pub api_key: Mutex<Option<Zeroizing<String>>>,
    pub cancellations: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            api_key: Mutex::new(None),
            cancellations: Mutex::new(HashMap::new()),
        }
    }
}
