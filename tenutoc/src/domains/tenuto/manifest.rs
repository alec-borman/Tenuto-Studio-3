pub struct Manifest {
    axes: Vec<Axis>,
}

pub struct Axis {
    name: String,
    dimension: usize,
}

pub fn get_global_manifest() -> Manifest {
    let mut axes = Vec::new();
    
    // Register axes for Tenuto 3.0 features
    register_axes(&mut axes);
    
    Manifest { axes }
}

pub fn register_axes(axes: &mut Vec<Axis>) {
    axes.push(Axis { name: "pillar_1:concrete_audio".to_string(), dimension: 100 });
    axes.push(Axis { name: "pillar_2:sidechain_ducking".to_string(), dimension: 200 });
    axes.push(Axis { name: "pillar_3:musicxml_export".to_string(), dimension: 300 });
    axes.push(Axis { name: "pillar_4:svg_engraving".to_string(), dimension: 400 });
    axes.push(Axis { name: "pillar_5:decompilation".to_string(), dimension: 500 });
}
