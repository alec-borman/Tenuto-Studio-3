export interface SmuflGlyph {
  path: string;
  opticalCenter: number;
  stemUpSE: [number, number];
  stemDownNW: [number, number];
}

export const SMUFL_METADATA: Record<string, SmuflGlyph> = {
  noteheadBlack: {
    path: "M 0 0 C 0 -0.3 0.3 -0.5 0.6 -0.5 C 0.9 -0.5 1.2 -0.3 1.2 0 C 1.2 0.3 0.9 0.5 0.6 0.5 C 0.3 0.5 0 0.3 0 0 Z",
    opticalCenter: 0.6,
    stemUpSE: [1.18, -0.16],
    stemDownNW: [0.02, 0.16]
  },
  noteheadHalf: {
    path: "M 0 0 C 0 -0.3 0.3 -0.5 0.6 -0.5 C 0.9 -0.5 1.2 -0.3 1.2 0 C 1.2 0.3 0.9 0.5 0.6 0.5 C 0.3 0.5 0 0.3 0 0 Z M 0.2 0 C 0.2 -0.2 0.4 -0.3 0.6 -0.3 C 0.8 -0.3 1.0 -0.2 1.0 0 C 1.0 0.2 0.8 0.3 0.6 0.3 C 0.4 0.3 0.2 0.2 0.2 0 Z",
    opticalCenter: 0.6,
    stemUpSE: [1.18, -0.16],
    stemDownNW: [0.02, 0.16]
  },
  noteheadWhole: {
    path: "M 0 0 C 0 -0.4 0.4 -0.6 0.8 -0.6 C 1.2 -0.6 1.6 -0.4 1.6 0 C 1.6 0.4 1.2 0.6 0.8 0.6 C 0.4 0.6 0 0.4 0 0 Z M 0.3 0 C 0.3 -0.2 0.5 -0.3 0.8 -0.3 C 1.1 -0.3 1.3 -0.2 1.3 0 C 1.3 0.2 1.1 0.3 0.8 0.3 C 0.5 0.3 0.3 0.2 0.3 0 Z",
    opticalCenter: 0.8,
    stemUpSE: [1.6, -0.16],
    stemDownNW: [0, 0.16]
  },
  gClef: {
    path: "M 0 0 C 0.5 -1 1.5 -2 1.5 -3 C 1.5 -4 0.5 -5 0 -5 C -0.5 -5 -1.5 -4 -1.5 -3 C -1.5 -2 -0.5 -1 0 0 C 0.5 1 1.5 2 1.5 3 C 1.5 4 0.5 5 0 5 C -0.5 5 -1.5 4 -1.5 3 C -1.5 2 -0.5 1 0 0 Z",
    opticalCenter: 0,
    stemUpSE: [0, 0],
    stemDownNW: [0, 0]
  },
  fClef: {
    path: "M 0 -1 C 0.5 -2 1.5 -3 1.5 -4 C 1.5 -5 0.5 -6 0 -6 C -0.5 -6 -1.5 -5 -1.5 -4 C -1.5 -3 -0.5 -2 0 -1 Z M 2 -3 A 0.2 0.2 0 1 1 2 -3.4 A 0.2 0.2 0 1 1 2 -3 Z M 2 -4 A 0.2 0.2 0 1 1 2 -4.4 A 0.2 0.2 0 1 1 2 -4 Z",
    opticalCenter: 0,
    stemUpSE: [0, 0],
    stemDownNW: [0, 0]
  }
};
