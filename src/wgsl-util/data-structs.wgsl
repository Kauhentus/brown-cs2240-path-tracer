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