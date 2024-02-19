fn mat_rodriguez(axis: vec3f, theta: f32) -> mat3x3f {
    let ct = cos(theta);
    let st = sin(theta);
    let x = axis.x;
    let y = axis.y;
    let z = axis.z;

    return mat3x3(
        ct + x*x * (1.0 - ct), x*y * (1.0 - ct) + z*st, x*z * (1.0 - ct) - y*st,
        x*y * (1.0 - ct) - z*st, ct + y*y * (1.0 - ct), y*z * (1.0 - ct) + x*st, 
        x*z * (1.0 - ct) + y*st, y*z * (1.0 - ct) - x*st, ct + z*z * (1.0 - ct)
    );
}

fn sample_hemisphere(x: vec4f, n: vec4f, seed: i32, importance_sample: bool) -> RaySample {
    let sample = hash2(u32(seed) * 7u + 11u);
    let xi_1 = sample.x;
    let xi_2 = sample.y;

    if(importance_sample){
        let phi = 2 * PI * xi_1;
        let theta = acos(sqrt(xi_2));
        
        let nx = cos(phi) * sin(theta);
        let ny = sin(phi) * sin(theta);
        let nz = cos(theta);
        let direction = vec3f(nx, ny, nz);

        let N = n.xyz;
        var s = 0.0;
        if(N.z < 0.0){
            s = -1.0;
        } else {
            s = 1.0;
        }
        let a = -1.0 / (s + N.z);
        let b = N.x * N.y * a;
        let T = vec3(1.0 + s * N.x * N.x * a, s * b, -s * N.x);
        let B = vec3(b, s + N.y * N.y * a, -N.y);

        let new_direction = T * nx + B * ny + N * nz;

        var p_omega = cos(theta) / PI;
        return RaySample(ray_with_epsilon(x, vec4(new_direction, 0.0)), p_omega); 
    }

    else {
        let phi = 2 * PI * xi_1;
        let theta = acos(xi_2);
        
        let nx = cos(phi) * sin(theta);
        let ny = sin(phi) * sin(theta);
        let nz = cos(theta);
        let direction = vec3f(nx, ny, nz);

        let N = n.xyz;
        var s = 0.0;
        if(N.z < 0.0){
            s = -1.0;
        } else {
            s = 1.0;
        }
        let a = -1.0 / (s + N.z);
        let b = N.x * N.y * a;
        let T = vec3(1.0 + s * N.x * N.x * a, s * b, -s * N.x);
        let B = vec3(b, s + N.y * N.y * a, -N.y);

        let new_direction = T * nx + B * ny + N * nz;

        var p_omega = 1.0 / (2.0 * PI);
        return RaySample(ray_with_epsilon(x, vec4(new_direction, 0.0)), p_omega);       
    }
}

fn sample_hemisphere_old(x: vec4f, n: vec4f, seed: i32) -> RaySample {
    let sample = hash2(u32(seed) * 7u + 11u);
    let xi_1 = 1.0 - (sample.x);
    let xi_2 = 1.0 - (sample.y);

    let theta = 2.0 * PI * xi_1;
    let phi = acos(2.0 * xi_2 - 1.0);
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