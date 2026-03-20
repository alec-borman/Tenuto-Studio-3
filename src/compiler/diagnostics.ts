export interface DiagnosticLocation {
  line: number;
  column: number;
}

export interface DiagnosticDetails {
  message: string;
  suggestion?: string;
}

export interface Diagnostic {
  status: 'fatal' | 'warning';
  code: string;
  type: string;
  location: DiagnosticLocation;
  diagnostics: DiagnosticDetails;
}

export class CompilerError extends Error {
  constructor(public diagnostic: Diagnostic) {
    super(`[${diagnostic.location.line}:${diagnostic.location.column}] ${diagnostic.diagnostics.message}`);
    this.name = 'CompilerError';
  }
}
