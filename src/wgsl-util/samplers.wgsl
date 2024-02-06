fn sample_hemisphere(x: vec4f, n: vec4f, seed: i32) -> RaySample {
    let sample = hash2(u32(seed) * 7u + 11u);
    let xi_1 = 1.0 - (sample.x);
    let xi_2 = 1.0 - (sample.y);

    let phi = 2 * PI * xi_1;
    let theta = PI * xi_2;
    let nx = sin(phi) * cos(theta);
    let ny = sin(phi) * sin(theta);
    let nz = cos(phi);

    let norm_n = normalize(n.xyz);
    var norm_d = vec3f(nx, ny, nz);
    if(norm_n.x * nx + norm_n.y * ny + norm_n.z * nz < 0){
        norm_d = -norm_d;
    }
    norm_d = normalize(norm_d);

    let p = 1.0 / (2.0 * PI);
    return RaySample(ray_with_epsilon(x, vec4(norm_d, 0.0)), p);
}

fn sample_triangle_2D(seed: u32) -> vec2f {
    let u = hash2(seed);
    let su0 = sqrt(u.x);
    return vec2(1 - su0, u.y * su0);
}

fn sample_triangle_3D(p0: vec3f, p1: vec3f, p2: vec3f, seed: u32) -> vec3f {
    let b = sample_triangle_2D(seed);
    let p = b.x * p0 + b.y * p1 + (1 - b.x - b.y) * p2;
    return p;
}