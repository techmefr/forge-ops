export type LayerRoot = {
  name: string
  directory: string
  alias?: string
}

export type ImportEdge = {
  from: string
  to: string
  fromLayer: string
  toLayer: string
  root: string
}

export declare const REPOSITORY_ROOT: string
export declare const BASELINE_PATH: string
export declare const LAYER_ROOTS: LayerRoot[]
export declare const scanRoot: (root: LayerRoot) => ImportEdge[]
export declare const isViolation: (edge: ImportEdge) => boolean
export declare const edgeKey: (edge: ImportEdge) => string
export declare const readBaseline: () => string[]
