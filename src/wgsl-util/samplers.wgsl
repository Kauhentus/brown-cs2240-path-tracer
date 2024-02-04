fn sample_hemisphere(x: vec4f, n: vec4f, seed: i32) -> RaySample {
    let sample = hash2(u32(seed) * 7u + 11u);
    let xi_1 = (sample.x);
    let xi_2 = (sample.y);

    // let phi = 2 * PI * xi_1;
    // let theta = PI * xi_2;

    // let nx = sin(phi) * cos(theta);
    // let ny = sin(phi) * sin(theta);
    // let nz = cos(phi);
    
    // let norm_n = normalize(n.xyz);
    // let u = normalize(cross(norm_n, vec3(1.0, 1.0, 0.0)));
    // let v = -normalize(cross(norm_n, u));

    // let norm_d = normalize(nx*u + ny*v + nz*norm_n);

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