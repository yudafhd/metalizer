use std::collections::HashMap;
use std::collections::HashSet;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use zeroize::Zeroizing;

use crate::models::AdobePopulationSearchResponse;

pub struct AppState {
    pub api_key: Mutex<Option<Zeroizing<String>>>,
    pub cancellations: Mutex<HashMap<String, Arc<AtomicBool>>>,
    pub population_search_cache: Mutex<HashMap<String, AdobePopulationSearchResponse>>,
    pub active_population_searches: Mutex<HashSet<String>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            api_key: Mutex::new(None),
            cancellations: Mutex::new(HashMap::new()),
            population_search_cache: Mutex::new(HashMap::new()),
            active_population_searches: Mutex::new(HashSet::new()),
        }
    }
}
