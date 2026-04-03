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
        // Map ConcreteParams to vector space: determinism (0), sovereignty (7), performance (6)
        for def in &ast.defs {
            if def.style == "concrete" {
                vector[0] += 1.0;
                vector[7] += 1.0;
                vector[6] += 0.7;
            }
        }
    }

    fn traverse_sidechain(&self, ast: &Ast, vector: &mut [f64]) {
        // Map Sidechain to vector space: performance (6), determinism (0)
        for measure in &ast.measures {
            for logic in &measure.logic {
                match logic {
                    LogicNode::Assignment(id, _) if id.contains("sidechain") => {
                        vector[6] += 0.9;
                        vector[0] += 0.9;
                    }
                    LogicNode::EventNode(Event::Spacer(_, mods)) if mods.iter().any(|m| m.contains("duck")) => {
                        vector[6] += 0.9;
                        vector[0] += 0.9;
                    }
                    _ => {}
                }
            }
        }
    }

    fn traverse_export(&self, ast: &Ast, vector: &mut [f64]) {
        // Map Export to vector space: sovereignty (7), ergonomics (3), determinism (0)
        if ast.meta.contains_key("export:musicxml") {
            vector[7] += 1.0;
            vector[3] += 0.8;
            vector[0] += 1.0;
        }
        if ast.meta.contains_key("engrave:svg") {
            vector[0] += 1.0;
            vector[7] += 0.8;
        }
        if ast.meta.contains_key("decompile:source") {
            vector[0] += 1.0;
            vector[7] += 0.9;
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
