use crate::ast::{Definition, Value};
use crate::ir::{ConcreteParams, Rational};
use std::collections::BTreeMap;

pub fn process_concrete_definition(def: &Definition) -> BTreeMap<String, ConcreteParams> {
    let mut map = BTreeMap::new();
    
    if let Some(ref def_map) = def.map {
        for (k, v) in def_map {
            if let Value::Array(ref arr) = v {
                if arr.len() >= 2 {
                    let params: ConcreteParams = ConcreteParams {
                        slice_start: Rational::new(arr[0].num as i64, arr[0].den as i64),
                        slice_end: Rational::new(arr[1].num as i64, arr[1].den as i64),
                        reverse: false,
                        chop_size: None,
                        stretch_factor: None,
                    };
                    map.insert(k.clone(), params);
                }
            }
        }
    }
    
    map
}
