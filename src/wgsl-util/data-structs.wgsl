struct Ray {
    p: vec4f,
    d: vec4f
}

struct Ray3 {
    p: vec3f,
    d: vec3f
}

struct RaySample {
    r: Ray,
    pdf: f32
}

struct Primitive {
    kind_material: vec4f, // kind, r, g, b
    ctm: mat4x4f,
    ctm_inv: mat4x4f,
    temp: vec4f // is_active, emissive
}

struct PrimitiveIntersection {
    primitive: Primitive,
    point: vec4f,
    normal: vec4f,
    intersected: bool,
    t: f32
}

struct Intersection {
    point: vec4f,
    normal: vec4f,
    intersected: bool,
    t: f32,
    material_id: i32
}

struct Material {
    Ns: f32,
    Ni: f32,
    illum: f32,
    Ka: vec3f,
    Kd: vec3f,
    Ks: vec3f,
    Ke: vec3f
}

fn null_intersection() -> Intersection {
    return Intersection(vec4(0.0), vec4(0.0), false, 0.0, 0);
}

fn eval_ray(ray: Ray, t: f32) -> vec4f {
    return ray.p + ray.d * t;
}

fn ray_with_epsilon(p: vec4f, d: vec4f) -> Ray {
    return Ray(p + 0.001 * d, d);
}

fn transform_ray(ray: Ray, transform: mat4x4<f32>) -> Ray {
    let new_p = transform * ray.p;
    let new_d = normalize(transform * ray.d);
    return Ray(new_p, new_d);
}