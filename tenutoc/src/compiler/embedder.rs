use crate::ast::*;
use crate::ir::*;

pub struct Embedder {
    dimensions: usize,
}

impl Embedder {
    pub fn new(dimensions: usize) -> Self {
        Self { dimensions }
    }

    pub fn project_domain_to_vector(&self, ast: &Ast) -> Vec<f64> {
        let mut vector = vec![0.0; self.dimensions];
        
        // Topologically traverse the AST nodes
        self.traverse_concrete_params(ast, &mut vector);
        self.traverse_sidechain(ast, &mut vector);
        self.traverse_export(ast, &mut vector);
        
        // Apply Depth Decay Formula
        self.apply_depth_decay(&mut vector);
        
        vector
    }

    fn traverse_concrete_params(&self, ast: &Ast, vector: &mut [f64]) {
        // Map ConcreteParams to vector space
        for def in &ast.defs {
            if def.style == "concrete" {
                vector[100] += 1.0; // Structural dimension for concrete_audio
            }
        }
    }

    fn traverse_sidechain(&self, ast: &Ast, vector: &mut [f64]) {
        // Map Sidechain to vector space
        for measure in &ast.measures {
            for logic in &measure.logic {
                match logic {
                    LogicNode::Assignment(id, _) if id.contains("sidechain") => {
                        vector[200] += 1.0;
                    }
                    LogicNode::EventNode(Event::Spacer(_, mods)) if mods.iter().any(|m| m.contains("duck")) => {
                        vector[200] += 1.0;
                    }
                    _ => {}
                }
            }
        }
    }

    fn traverse_export(&self, ast: &Ast, vector: &mut [f64]) {
        // Map Export to vector space based on metadata or specific nodes
        if ast.meta.contains_key("export:musicxml") {
            vector[300] += 1.0;
        }
        if ast.meta.contains_key("engrave:svg") {
            vector[400] += 1.0;
        }
        if ast.meta.contains_key("decompile:source") {
            vector[500] += 1.0;
        }
    }

    fn apply_depth_decay(&self, vector: &mut [f64]) {
        // Mock Depth Decay Formula
        for val in vector.iter_mut() {
            if *val > 0.0 {
                *val = (*val).sqrt();
            }
        }
    }
}
