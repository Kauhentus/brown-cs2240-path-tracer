import { Bounds, Vertex } from "@toysinbox3dprinting/js-geometry"

// parsing types
export type CameraData = {
    focus: Vertex,
    heightangle: number,
    pos: Vertex,
    up: Vertex
}

export type SceneObjectNode = {
    type: "primitive" | "tree",
    name: string,
    data?: PrimitiveData
    ctm: number[],
    child_objects: SceneObjectNode[]
}

export type PrimitiveData = {
    path: string
}

// intermediate types
export type SceneObjectGroup = {
    vertices: number[],
    vertex_normals: number[],
    objects: SceneObject[]
}

export type SceneObject = {
    name: string,
    indices: number[],
    material?: SceneObjectMaterial
}

export type SceneObjectMaterial = {
    Ns: number,
    Ni: number,
    illum: number,
    Ka: number[],
    Kd: number[],
    Ks: number[],
    Ke: number[]
}

export type SceneObjectPacked = {
    triangle_data: Float32Array;
    bvh_data: Float32Array;
    bounds: Bounds;
}
