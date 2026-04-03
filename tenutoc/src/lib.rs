use wasm_bindgen::prelude::*;
use chumsky::Parser;
use logos::Logos;
use serde::{Deserialize, Serialize};

pub mod lexer;
pub mod ast;
pub mod parser;
pub mod preprocessor;
pub mod ir;
pub mod spelling;
pub mod rebar;
pub mod midi;
pub mod export;
pub mod engrave;
pub mod decompile;
pub mod emitter;
pub mod cursor;
pub mod euclidean;
pub mod concrete;
pub mod sidechain;

#[derive(Serialize, Deserialize)]
pub struct WasmDiagnostic {
    pub code: String,
    pub message: String,
    pub line: usize,
    pub column: usize,
}

pub fn compile_to_timeline(source: &str) -> Result<ir::Timeline, String> {
    let tokens: Vec<lexer::Token> = lexer::Token::lexer(source).filter_map(|res| res.ok()).collect();
    let ast = parser::parser().parse(tokens).map_err(|e| format!("{:?}", e))?;
    
    let mut preprocessor = preprocessor::Preprocessor::new();
    let expanded_ast = preprocessor.expand(ast).map_err(|e| e.to_string())?;
    
    ir::compile(expanded_ast, false).map_err(|e| e.to_string())
}

#[wasm_bindgen]
pub fn compile_tenuto_json(source: &str) -> Result<String, JsValue> {
    let timeline = compile_to_timeline(source).map_err(|e| JsValue::from_str(&e))?;
    emitter::to_json(&timeline).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn compile_tenuto_midi(source: &str) -> Result<Vec<u8>, JsValue> {
    let timeline = compile_to_timeline(source).map_err(|e| JsValue::from_str(&e))?;
    emitter::to_midi(&timeline).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn compile_tenuto_to_svg(source: &str) -> Result<String, String> {
    let tokens: Vec<lexer::Token> = lexer::Token::lexer(source).filter_map(|res| res.ok()).collect();
    let ast = parser::parser().parse(tokens).map_err(|e| format!("{:?}", e))?;
    
    let mut preprocessor = preprocessor::Preprocessor::new();
    let expanded_ast = preprocessor.expand(ast).map_err(|e| e.to_string())?;
    
    engrave::export_svg(&expanded_ast).map_err(|e| e.to_string())
}

#[wasm_bindgen]
pub fn decompile_midi_to_tenuto(midi_bytes: &[u8]) -> Result<String, String> {
    decompile::decompile_midi(midi_bytes).map_err(|e| e.to_string())
}

// Zero-copy memory transfer endpoints for massive MIDI files
#[wasm_bindgen]
pub fn alloc_buffer(size: usize) -> *mut u8 {
    let mut buf = Vec::with_capacity(size);
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

#[wasm_bindgen]
pub fn free_buffer(ptr: *mut u8, size: usize) {
    unsafe {
        let _ = Vec::from_raw_parts(ptr, 0, size);
    }
}

#[wasm_bindgen]
pub fn decompile_midi_zero_copy(ptr: *const u8, len: usize) -> Result<String, String> {
    let midi_bytes = unsafe { std::slice::from_raw_parts(ptr, len) };
    decompile::decompile_midi(midi_bytes).map_err(|e| e.to_string())
}
