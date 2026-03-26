use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Instrument {
    pub source: String,
    pub format: String,
    pub license: Option<String>,
    pub regions: Vec<SampleRegion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SampleRegion {
    pub sample: String,
    pub lokey: u8,
    pub hikey: u8,
    pub pitch_keycenter: u8,
    pub lovel: u8,
    pub hivel: u8,
}
