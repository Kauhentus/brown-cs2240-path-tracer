fn mat_rodriguez(axis: vec3f, theta: f32) -> mat4x4f {
    let ct = cos(theta);
    let st = sin(theta);
    let x = axis.x;
    let y = axis.y;
    let z = axis.z;

    return mat4x4(
        ct + x*x * (1.0 - ct), x*y * (1.0 - ct) + z*st, x*z * (1.0 - ct) - y*st, 0.0,
        x*y * (1.0 - ct) - z*st, ct + y*y * (1.0 - ct), y*z * (1.0 - ct) + x*st, 0.0,
        x*z * (1.0 - ct) + y*st, y*z * (1.0 - ct) - x*st, ct + z*z * (1.0 - ct), 0.0,
        0.0, 0.0, 0.0, 1.0
    );
}

fn sample_hemisphere2(x: vec4f, n: vec4f, seed: i32) -> RaySample {
    let sample = hash2(u32(seed));
    let xi_1 = sample.x;
    let xi_2 = sample.y;

    let phi = 2 * PI * xi_1;
    let theta = acos(1.0 - xi_2);
    
    let nx = cos(phi) * sin(theta);
    let ny = sin(phi) * sin(theta);
    let nz = cos(theta);
    let direction = normalize(vec3f(nx, ny, nz));

    let mut_orthog = cross(n.xyz, direction);
    let mut_angle = acos(dot(n.xyz, direction));
    let rot_mat = mat_rodriguez(mut_orthog, mut_angle);
    let new_direction = rot_mat * vec4(direction, 0.0);

    var p_omega = 1.0 / (2.0 * PI);
    return RaySample(ray_with_epsilon(x, new_direction), p_omega); 
}

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