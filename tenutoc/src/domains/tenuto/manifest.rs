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
    axes.push(Axis { name: "arch:determinism".to_string(), dimension: 0 });
    axes.push(Axis { name: "arch:ergonomics".to_string(), dimension: 3 });
    axes.push(Axis { name: "arch:performance".to_string(), dimension: 6 });
    axes.push(Axis { name: "arch:sovereignty".to_string(), dimension: 7 });
}
