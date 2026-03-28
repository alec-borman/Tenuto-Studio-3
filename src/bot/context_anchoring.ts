// sprint:context_anchoring

export function grammarConstrainedGeneration(prompt: string, grammar: any): string {
  // Mock grammar constrained generation
  return `Generated output constrained by grammar for prompt: ${prompt}`;
}

export function preCommitTelaScan(telaCode: string): boolean {
  // Mock pre-commit scan
  if (telaCode.includes('error')) {
    return false;
  }
  return true;
}
