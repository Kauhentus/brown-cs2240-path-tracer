import { Vertex } from "@toysinbox3dprinting/js-geometry"

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

export type SceneObjectGroup = {
    vertices: number[],
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
