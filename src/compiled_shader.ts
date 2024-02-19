export const compiled_shader = `
struct Ray {
    p: vec4f,
    d: vec4f,
    d_inv: vec4f
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
    return Ray(p + 0.001 * d, d, 1.0 / d);
}

fn transform_ray(ray: Ray, transform: mat4x4<f32>) -> Ray {
    let new_p = transform * ray.p;
    let new_d = normalize(transform * ray.d);
    return Ray(new_p, new_d, 1.0 / new_d);
}
fn mat4_identity() -> mat4x4f {
    return mat4x4f(
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    );
}

fn null_primitive() -> Primitive {
    return Primitive(vec4f(0), mat4_identity(), mat4_identity(), vec4f(0));
}

fn null_primitive_intersection() -> PrimitiveIntersection {
    return PrimitiveIntersection(null_primitive(), vec4(0), vec4(0), false, 0.0);
}

fn intersect_unit_cube(primitive: Primitive, r: Ray) -> PrimitiveIntersection {
    let p = r.p;
    let d = r.d;

    var nT = -1.0;
    var normal: vec4f = vec4(0.0);

    // intersect x-sides
    let lxt = (-0.5f - p.x) / d.x;
    let hxt = (0.5f - p.x) / d.x; 
    let lxty = p.y + lxt * d.y; 
    let lxtz = p.z + lxt * d.z;
    let hxty = p.y + hxt * d.y;
    let hxtz = p.z + hxt * d.z;

    if(max(abs(lxty), abs(lxtz)) <= 0.5){
        if(lxt > 0 && nT <= 0) {
            nT = lxt;
            normal = vec4(-1.0, 0.0, 0.0, 0.0);
        }
        else if(lxt > 0 && nT > 0 && lxt < nT) {
            nT = lxt;
            normal = vec4(-1.0, 0.0, 0.0, 0.0);
        }
    }
    if(max(abs(hxty), abs(hxtz)) <= 0.5){
        if(hxt > 0 && nT <= 0) {
            nT = hxt;
            normal = vec4(1.0, 0.0, 0.0, 0.0);
        }
        else if(hxt > 0 && nT > 0 && hxt < nT) {
            nT = hxt;
            normal = vec4(1.0, 0.0, 0.0, 0.0);
        }
    }

    // intersect y-sides
    let lyt = (-0.5f - p.y) / d.y; 
    let hyt = (0.5f - p.y) / d.y; 
    let lytx = p.x + lyt * d.x; 
    let lytz = p.z + lyt * d.z;
    let hytx = p.x + hyt * d.x;
    let hytz = p.z + hyt * d.z;

    if(max(abs(lytx), abs(lytz)) <= 0.5){ 
        if(lyt > 0 && nT <= 0) {
            nT = lyt;
            normal = vec4(0.0, -1.0, 0.0, 0.0);
        }
        else if(lyt > 0 && nT > 0 && lyt < nT) {
            nT = lyt;
            normal = vec4(0.0, -1.0, 0.0, 0.0);
        }
    }
    if(max(abs(hytx), abs(hytz)) <= 0.5){ 
        if(hyt > 0 && nT <= 0) {
            nT = hyt;
            normal = vec4(0.0, 1.0, 0.0, 0.0);
        }
        else if(hyt > 0 && nT > 0 && hyt < nT) {
            nT = hyt;
            normal = vec4(0.0, 1.0, 0.0, 0.0);
        }
    }

    // intersect z-sides
    let lzt = (-0.5f - p.z) / d.z; 
    let hzt = (0.5f - p.z) / d.z; 
    let lztx = p.x + lzt * d.x; 
    let lzty = p.y + lzt * d.y;
    let hztx = p.x + hzt * d.x;
    let hzty = p.y + hzt * d.y;

    if(max(abs(lztx), abs(lzty)) <= 0.5){ 
        if(lzt > 0 && nT <= 0) {
            nT = lzt;
            normal = vec4(0.0, 0.0, -1.0, 0.0);
        }
        else if(lzt > 0 && nT > 0 && lzt < nT) {
            nT = lzt;
            normal = vec4(0.0, 0.0, -1.0, 0.0);
        }
    }
    if(max(abs(hztx), abs(hzty)) <= 0.5){
        if(hzt > 0 && nT <= 0) {
            nT = hzt;
            normal = vec4(0.0, 0.0, 1.0, 0.0);
        }
        else if(hzt > 0 && nT > 0 && hzt < nT) {
            nT = hzt;
            normal = vec4(0.0, 0.0, 1.0, 0.0);
        }
    }

    if(nT > 0){
        return PrimitiveIntersection(primitive, eval_ray(r, nT), normal, true, nT);
    } else {
        return null_primitive_intersection();
    }
}

fn intersect_unit_sphere(primitive: Primitive, r: Ray) -> PrimitiveIntersection {
    let A = r.d.x * r.d.x + r.d.y * r.d.y + r.d.z * r.d.z;
    let B = 2.0f * r.d.x * r.p.x
            + 2.0f * r.d.y * r.p.y
            + 2.0f * r.d.z * r.p.z;
    let C = r.p.x * r.p.x + r.p.y * r.p.y + r.p.z * r.p.z - 0.5 * 0.5;
    let discr = B * B - 4 * A * C;
    if(discr < 0) { return null_primitive_intersection(); }

    let t1 = (-B + sqrt(discr))/(2 * A);
    let t2 = (-B - sqrt(discr))/(2 * A);
    var ft = -1.0; 
    if(t1 > 0 && t2 > 0){ ft = min(t1, t2); }
    else if(t1 > 0){ ft = t1; }
    else { ft = t2; }

    let point = eval_ray(r, ft);
    let partialX = 2 * point.x;
    let partialY = 2 * point.y;
    let partialZ = 2 * point.z;
    let normal = normalize(vec4(partialX, partialY, partialZ, 0.0f));

    return PrimitiveIntersection(primitive, point, normal, true, ft);
}

fn hash1u(_n: u32) -> u32 {
    var n = _n;
    let t = meta_data.aspect_and_time[1];

	n = (n << 13u) ^ n;
    n = n * (n * n * 15731u + 789221u) + 1376312589u;
    return n & 0x7fffffffu;
}

fn hash1(_n: u32) -> f32 {
    var n = _n;
    let t = meta_data.aspect_and_time[1];

	n = (n << 13u) ^ n;
    n = n * (n * n * 15731u + 789221u) + 1376312589u;
    return 1.0 - f32(n & 0x7fffffffu) / f32(0x7fffffff);
}

fn hash2(_n: u32) -> vec2f {
    var n = _n;
    let t = meta_data.aspect_and_time[1];

	n = (n << 13u) ^ n;
    n = n * (n * n * 15731u + 789221u) + 1376312589u;
    let k = n * vec2(n, n*16807u);

    return vec2f(k & vec2(0x7fffffffu)) / f32(0x7fffffff);
}

fn ihash1(_n: u32) -> u32 {
    var n = _n;
	n = (n << 13u) ^ n;
    n = n * (n * n * 15731u + 789221u) + 1376312589u;
    return n;
}

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
fn ray_triangle_intersection(r: Ray, v0: vec3f, v1: vec3f, v2: vec3f) -> Intersection {
    let ray_vector = r.d.xyz;
    let ray_origin = r.p.xyz;

    let epsilon = 1e-8;
    let edge1 = v1 - v0;
    let edge2 = v2 - v0;
    let ray_cross_e2 = cross(ray_vector, edge2);
    let det = dot(edge1, ray_cross_e2);

    if (det > -epsilon && det < epsilon){
        return null_intersection();
    }
        
    let inv_det = 1.0 / det;
    let s = ray_origin - v0;
    let u = inv_det * dot(s, ray_cross_e2);

    if (u < 0.0 || u > 1.0){
        return null_intersection();
    }

    let s_cross_e1 = cross(s, edge1);
    let v = inv_det * dot(ray_vector, s_cross_e1);

    if (v < 0.0 || u + v > 1.0){
        return null_intersection();
    }

    let t = inv_det * dot(edge2, s_cross_e1);

    if (t > epsilon) {
        let out_intersection_point = ray_origin + ray_vector * t;
        return Intersection(
            vec4(out_intersection_point, 1.0), 
            vec4(normalize(cross(edge1, edge2)), 0.0), 
            true, t, 0
        );
    } else {
        return null_intersection();
    }
}

fn ray_triangle_intersection_vertex_normals(
    r: Ray, v0: vec3f, v1: vec3f, v2: vec3f,
    v0n: vec3f, v1n: vec3f, v2n: vec3f,
) -> Intersection {
    let ray_vector = r.d.xyz;
    let ray_origin = r.p.xyz;

    let epsilon = 1e-8;
    let edge1 = v1 - v0;
    let edge2 = v2 - v0;
    let ray_cross_e2 = cross(ray_vector, edge2);
    let det = dot(edge1, ray_cross_e2);

    if (det > -epsilon && det < epsilon){
        return null_intersection();
    }
        
    let inv_det = 1.0 / det;
    let s = ray_origin - v0;
    let u = inv_det * dot(s, ray_cross_e2);
    if (u < 0.0 || u > 1.0){
        return null_intersection();
    }

    let s_cross_e1 = cross(s, edge1);
    let v = inv_det * dot(ray_vector, s_cross_e1);
    if (v < 0.0 || u + v > 1.0){
        return null_intersection();
    }

    let w = 1.0 - u - v;
    let t = inv_det * dot(edge2, s_cross_e1);

    if (t > epsilon) {
        let out_intersection_point = ray_origin + ray_vector * t;
        return Intersection(
            vec4(out_intersection_point, 1.0), 
            vec4(normalize(w*v0n + u*v1n + v*v2n), 0.0), 
            true, t, 0
        );
    } else {
        return null_intersection();
    }
}
fn ray_bbox_intersection(r: Ray, min_corner: vec3f, max_corner: vec3f) -> f32 {
    // faster ray-box intersection from https://tavianator.com/2015/ray_box_nan.html
    var tmin = -3.0e+38;
    var tmax = 3.0e+38;

    let t1x = (min_corner.x - r.p.x) * (r.d_inv.x);
    let t2x = (max_corner.x - r.p.x) * (r.d_inv.x);
    tmin = max(tmin, min(t1x, t2x));
    tmax = min(tmax, max(t1x, t2x));

    let t1y = (min_corner.y - r.p.y) * (r.d_inv.y);
    let t2y = (max_corner.y - r.p.y) * (r.d_inv.y);
    tmin = max(tmin, min(t1y, t2y));
    tmax = min(tmax, max(t1y, t2y));

    let t1z = (min_corner.z - r.p.z) * (r.d_inv.z);
    let t2z = (max_corner.z - r.p.z) * (r.d_inv.z);
    tmin = max(tmin, min(t1z, t2z));
    tmax = min(tmax, max(t1z, t2z));

    // return tmax > max(tmin, 0.0f);
    if(tmax > max(tmin, 0.0f)){
        if(tmin > 0.0) {
            return tmin;
        } else {
            return tmax;
        }
    } else {
        return -1.0;
    }
}

fn ray_bbox_intersection_v2(r: Ray, min_corner: vec3f, max_corner: vec3f) -> bool {
    if(
        min_corner.x <= r.p.x && r.p.x <= max_corner.x &&
        min_corner.y <= r.p.y && r.p.y <= max_corner.y &&
        min_corner.z <= r.p.z && r.p.z <= max_corner.z
    ){
        return true;
    }

    let tMin = (min_corner - r.p.xyz) / r.d.xyz;
    let tMax = (max_corner - r.p.xyz) / r.d.xyz;
    let t1 = min(tMin, tMax);
    let t2 = max(tMin, tMax);
    let tNear = max(max(t1.x, t1.y), t1.z);
    let tFar = min(min(t2.x, t2.y), t2.z);
    return tNear < tFar;
}
fn intersect(cur_ray: Ray) -> Intersection {
    // first intersect BVH to find candidate triangles

    var stack = array( 
        6, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
    );
    var stack_pointer = 0;
    var cur_depth = 0;
    var num_tri_ints = 0;

    let num_vertices = primitive_0[0];
    let num_objects = primitive_0[1];
    let o_start = i32(primitive_0[3]);
    let v_start_offset = i32(primitive_0[2]);

    let vn_start_offset = i32(primitive_0[5]);
    let vn_range = i32(primitive_0[6]);

    var closest_intersection = null_intersection();
    var closest_t = -1.0;    

    while(stack_pointer > -1){
        let pointer = stack[stack_pointer];

        let left_min = vec3f(bvh_0[pointer + 5], bvh_0[pointer + 6], bvh_0[pointer + 7]);
        let left_max = vec3f(bvh_0[pointer + 8], bvh_0[pointer + 9], bvh_0[pointer + 10]);
        let right_min = vec3f(bvh_0[pointer + 11], bvh_0[pointer + 12], bvh_0[pointer + 13]);
        let right_max = vec3f(bvh_0[pointer + 14], bvh_0[pointer + 15], bvh_0[pointer + 16]);

        let left_intersect_dist = ray_bbox_intersection(cur_ray, left_min, left_max);
        let right_intersect_dist = ray_bbox_intersection(cur_ray, right_min, right_max);
        let left_intersect = 0.0 < left_intersect_dist;
        let right_intersect = 0.0 < right_intersect_dist;

        var left_is_leaf = false;
        var right_is_leaf = false;

        if(left_intersect){
            let left_pointer = i32(bvh_0[pointer + 2]);
            let is_leaf = bvh_0[left_pointer] == 1;

            if(is_leaf){
                left_is_leaf = true;

                let num_triangles = bvh_0[left_pointer + 4];
                let bvh_o_start = left_pointer + 5 + 12;
                let bvh_o_end = bvh_o_start + i32(num_triangles);

                for(var i = bvh_o_start; i < bvh_o_end; i += 4){
                    let i0 = (i32(bvh_0[i]) - 1) * 3;
                    let i1 = (i32(bvh_0[i + 1]) - 1) * 3;
                    let i2 = (i32(bvh_0[i + 2]) - 1) * 3;

                    let v0 = vec3f(
                        primitive_0[v_start_offset + i0], 
                        primitive_0[v_start_offset + i0 + 1], 
                        primitive_0[v_start_offset + i0 + 2], 
                    );
                    let v1 = vec3f(
                        primitive_0[v_start_offset + i1], 
                        primitive_0[v_start_offset + i1 + 1], 
                        primitive_0[v_start_offset + i1 + 2], 
                    );
                    let v2 = vec3f(
                        primitive_0[v_start_offset + i2], 
                        primitive_0[v_start_offset + i2 + 1], 
                        primitive_0[v_start_offset + i2 + 2], 
                    );

                    let intersection = ray_triangle_intersection(
                        cur_ray, v0, v1, v2
                    );

                    num_tri_ints += 1;

                    if(intersection.intersected){
                        if(closest_t < 0 || intersection.t < closest_t){
                            closest_intersection = intersection;
                            closest_t = intersection.t;
                            closest_intersection.material_id = i32(bvh_0[i + 3]);
                        }
                    }
                }
            }
        }

        if(right_intersect){
            let right_pointer = i32(bvh_0[pointer + 3]);
            let is_leaf = bvh_0[right_pointer] == 1;

            if(is_leaf){
                right_is_leaf = true;

                let num_triangles = bvh_0[right_pointer + 4];
                let bvh_o_start = right_pointer + 5 + 12;
                let bvh_o_end = bvh_o_start + i32(num_triangles);

                let o_start = i32(primitive_0[3]);
                let v_start_offset = i32(primitive_0[2]);

                for(var i = bvh_o_start; i < bvh_o_end; i += 4){
                    let i0 = (i32(bvh_0[i]) - 1) * 3;
                    let i1 = (i32(bvh_0[i + 1]) - 1) * 3;
                    let i2 = (i32(bvh_0[i + 2]) - 1) * 3;

                    let v0 = vec3f(
                        primitive_0[v_start_offset + i0], 
                        primitive_0[v_start_offset + i0 + 1], 
                        primitive_0[v_start_offset + i0 + 2], 
                    );
                    let v1 = vec3f(
                        primitive_0[v_start_offset + i1], 
                        primitive_0[v_start_offset + i1 + 1], 
                        primitive_0[v_start_offset + i1 + 2], 
                    );
                    let v2 = vec3f(
                        primitive_0[v_start_offset + i2], 
                        primitive_0[v_start_offset + i2 + 1], 
                        primitive_0[v_start_offset + i2 + 2], 
                    );

                    let intersection = ray_triangle_intersection(
                        cur_ray, v0, v1, v2
                    );
                    num_tri_ints += 1;

                    if(intersection.intersected){
                        if(closest_t < 0 || intersection.t < closest_t){
                            closest_intersection = intersection;
                            closest_t = intersection.t;
                            closest_intersection.material_id = i32(bvh_0[i + 3]);
                        }
                    }
                }
            }
        }

        let traverse_left = left_intersect && !left_is_leaf 
            && !(closest_t > 0 && left_intersect_dist > closest_t);
        let traverse_right = right_intersect && !right_is_leaf 
            && !(closest_t > 0 && right_intersect_dist > closest_t);

        if(!traverse_left && !traverse_right){
            stack_pointer -= 1;
            if(stack_pointer < 0){ break; }
                
            while(stack[stack_pointer] == -1){
                stack_pointer -= 1;
                if(stack_pointer < 0){ break; }
            }
        } else {
            stack[stack_pointer] = -1; 

            if(traverse_left && !traverse_right){
                stack_pointer += 1;
                stack[stack_pointer] = i32(bvh_0[pointer + 2]);
            } 
            
            else if(!traverse_left && traverse_right){
                stack_pointer += 1;
                stack[stack_pointer] = i32(bvh_0[pointer + 3]);
            } 
            
            else { // traverse both
                stack[stack_pointer + 1] = i32(bvh_0[pointer + 2]);
                stack_pointer += 2;
                stack[stack_pointer] = i32(bvh_0[pointer + 3]);
            }
        }

        cur_depth += 1;
    }

    return closest_intersection;
}

fn sample_area_lights(x: vec3f, seed: i32) -> vec4f {
    let e1_start = i32(primitive_0[8]);
    let e1_end = i32(primitive_0[9]);
    let e2_start = i32(primitive_0[10]);
    let e2_end = i32(primitive_0[11]);
    let e3_start = i32(primitive_0[12]);
    let e3_end = i32(primitive_0[13]);
    let e4_start = i32(primitive_0[14]);
    let e4_end = i32(primitive_0[15]);

    var num_emissive = 0;
    var num_e1_triangles = 0;
    var num_e2_triangles = 0;
    var num_e3_triangles = 0;
    var num_e4_triangles = 0;
    if(e1_start != -1) { num_emissive += 1; num_e1_triangles += (e1_end - e1_start) / 4; }
    if(e2_start != -1) { num_emissive += 1; num_e2_triangles += (e2_end - e2_start) / 4; }
    if(e3_start != -1) { num_emissive += 1; num_e3_triangles += (e3_end - e3_start) / 4; }
    if(e4_start != -1) { num_emissive += 1; num_e4_triangles += (e4_end - e4_start) / 4; }

    // TODO: do better than choosing a random triangle
    var num_triangles = num_e1_triangles + num_e2_triangles + num_e3_triangles + num_e4_triangles;
    var random_triangle = i32(hash1(u32(seed) * 7u + 11u) * f32(num_triangles));

    var actual_index = 0;
    if(random_triangle < num_e1_triangles){
        let triangle_region_index = random_triangle;
        actual_index = triangle_region_index * 4 + e1_start;
    } 
    else if(random_triangle < num_e1_triangles + num_e2_triangles){
        let triangle_region_index = random_triangle - num_e1_triangles;
        actual_index = triangle_region_index * 4 + e2_start;
    } 
    else if(random_triangle < num_e1_triangles + num_e2_triangles + num_e3_triangles){
        let triangle_region_index = random_triangle - num_e1_triangles - num_e2_triangles;
        actual_index = triangle_region_index * 4 + e3_start;
    } 
    else {
        let triangle_region_index = random_triangle - num_e1_triangles - num_e2_triangles - num_e3_triangles;
        actual_index = triangle_region_index * 4 + e4_start;
    }

    // get triangle vertices
    let v_start_offset = i32(primitive_0[2]);
    let i0 = (i32(primitive_0[actual_index]) - 1) * 3;
    let i1 = (i32(primitive_0[actual_index + 1]) - 1) * 3;
    let i2 = (i32(primitive_0[actual_index + 2]) - 1) * 3;

    let v0 = vec3f(
        primitive_0[v_start_offset + i0], 
        primitive_0[v_start_offset + i0 + 1], 
        primitive_0[v_start_offset + i0 + 2], 
    );
    let v1 = vec3f(
        primitive_0[v_start_offset + i1], 
        primitive_0[v_start_offset + i1 + 1], 
        primitive_0[v_start_offset + i1 + 2], 
    );
    let v2 = vec3f(
        primitive_0[v_start_offset + i2], 
        primitive_0[v_start_offset + i2 + 1], 
        primitive_0[v_start_offset + i2 + 2], 
    );

    let rand_pt_on_tri = sample_triangle_3D(v0, v1, v2, u32(seed) * 11u + 17u);

    let direction = normalize(rand_pt_on_tri - x);
    return vec4(direction, 1.0 / f32(num_triangles));
}


const PI = 3.14159;

struct MetaData {
    resolution: vec2f,
    camera_data: vec2f,
    camera_pos: vec4f,

    resolution_inv: vec2f,
    aspect_and_time: vec2f,

    world_to_cam: mat4x4<f32>,
    cam_to_world: mat4x4<f32>,
    params: vec4f,
    params_2: vec4f
}

struct OutputData {
    numbers: array<f32>,
}

@group(0) @binding(0) var<storage, read> meta_data : MetaData;
@group(0) @binding(1) var<storage, read_write> resultMatrix : OutputData;

@group(0) @binding(3) var<storage, read> primitive_0 : array<f32>;

@group(0) @binding(10) var<storage, read> bvh_0 : array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id : vec3u) {
    // prepare meta variables
    let size = meta_data.resolution;
    let size_inv = meta_data.resolution_inv;
    let focal_length = meta_data.camera_data[0];
    let v_fov = meta_data.camera_data[1];

    let camera_pos =  meta_data.camera_pos;
    let aspect_ratio = meta_data.aspect_and_time[0];
    let t = meta_data.aspect_and_time[1];
    let world_to_cam = meta_data.world_to_cam;
    let cam_to_world = meta_data.cam_to_world;

    // guard against out-of-bounds work group sizes    
    if (global_id.x >= u32(size.x) || global_id.y >= u32(size.y)) { return; };
    let index = (global_id.x + global_id.y * u32(size.x)) * 1;

    var temp_seed = index * 16787u + u32(t);
    temp_seed = hash1u(temp_seed);
    temp_seed = hash1u(temp_seed);
    let pixel_jitter = hash2(temp_seed) - 0.5;
    let gx = f32(global_id.x) + pixel_jitter.x;
    let gy = f32(global_id.y) + pixel_jitter.y;

    let norm_x = (gx + 0.5f) * size_inv.x - 0.5f;
    let norm_y = (size.y - 1.f - gy + 0.5f) * size_inv.y - 0.5f;
    let view_half_h = 2.f * focal_length * tan(v_fov * 0.5);
    let view_half_w = view_half_h * aspect_ratio;
    let view_plane_x = view_half_w * norm_x;
    let view_plane_y = view_half_h * norm_y;

    var total_color = vec3(0.0, 0.0, 0.0);
    let num_samples = 1;
    temp_seed = hash1u(temp_seed);
    for(var i = 0; i < num_samples; i++){
        let p_pixel = vec4(view_plane_x, view_plane_y, -focal_length, 1.0f);
        let p_pixelv = cam_to_world * p_pixel;
        let direction = normalize(p_pixelv - camera_pos);
        var ray_world = Ray(camera_pos, direction, 1.0 / direction);

        temp_seed = hash1u(temp_seed + u32(i + i32(index * 67) + i32(t)));
        var color = radiance(ray_world, i32(temp_seed));
        total_color += color;
    }
    // total_color *= 1.0 / f32(num_samples);

    resultMatrix.numbers[index * 3] = total_color.x;
    resultMatrix.numbers[index * 3 + 1] = total_color.y;
    resultMatrix.numbers[index * 3 + 2] = total_color.z;
}

fn get_material(material_id: i32) -> Material {
    let m_start = i32(primitive_0[4]);
    let offset = material_id * 15;
    let m = m_start + offset;

    return Material(
        primitive_0[m],
        primitive_0[m + 1],
        primitive_0[m + 2],

        vec3f(primitive_0[m + 3], primitive_0[m + 4], primitive_0[m + 5]),
        vec3f(primitive_0[m + 6], primitive_0[m + 7], primitive_0[m + 8]),
        vec3f(primitive_0[m + 9], primitive_0[m + 10], primitive_0[m + 11]),
        vec3f(primitive_0[m + 12], primitive_0[m + 13], primitive_0[m + 14]),
    );
}

fn radiance(_ray: Ray, _seed: i32) -> vec3f {
    var L = vec3(0.0);
    var acc_color = vec3(1.0);
    var beta = vec3(1.0);
    let rr_prob = meta_data.params[1];
    let direct_lighting_only = meta_data.params[2] > 0;
    let use_microfacet = meta_data.params[3] > 0;
    let use_importance_sampling = meta_data.params_2[0] > 0;

    var depth = 0;
    var ray = _ray;
    var hit_specular = false;

    var seed = hash1u(u32(_seed));
    seed = hash1u(seed);

    while(depth <= 8){
        //////////////////////
        // SAMPLING LOGIC
        //////////////////////

        var closest_intersection = intersect(ray);
        if(!closest_intersection.intersected){
            break;
        }
        
        let cur_material = get_material(closest_intersection.material_id);
        let cur_normal = closest_intersection.normal;
        let cur_pt = closest_intersection.point;

        ////////////////////////////
        // EMISSIVE LIGHTING LOGIC
        ////////////////////////////
        if(dot(cur_material.Ke, vec3f(1.0)) > 0){ 
            if(depth == 0 || hit_specular){
                L += beta * cur_material.Ke;
                break;
            }
        }

        ///////////////////////////
        // DIRECT LIGHTING LOGIC
        ///////////////////////////
        let offset_pt = cur_pt + cur_normal * 1.0e-4;
        seed = hash1u(seed);
        let sample_area_light_output = sample_area_lights(offset_pt.xyz, i32(seed));
        let light_direction = vec4(sample_area_light_output.xyz, 0.0);
        let sample_area_light_mc_term = sample_area_light_output.w;
        let to_light_test = intersect(Ray(offset_pt, light_direction, 1.0 / light_direction));
        if(to_light_test.intersected){
            let new_material = get_material(to_light_test.material_id);
            if(dot(new_material.Ke, vec3f(1.0)) > 0){ 
                let light_normal = to_light_test.normal.xyz;
                let light_point = to_light_test.point;
                let attenuated_distance = pow(length(cur_pt - light_point), 2.0); 

                var brdf = vec3(0.0);
                if(cur_material.Ns == 40.0){
                    let n = cur_material.Ns;
                    let w_i = ray.d.xyz;
                    let n_hat = cur_normal.xyz;
                    let refl = w_i  - 2*dot(w_i, n_hat) * n_hat;
                    let q = dot(refl, light_direction.xyz);
                    if(q < 0){
                        brdf = -q * cur_material.Kd / PI;
                    } else {
                        let scaling_factor: f32 = (n + 2.0) * pow(q, n) / (2.0 * PI);
                        brdf = cur_material.Ks * scaling_factor;
                    }

                } else {
                    brdf = cur_material.Kd / PI;
                }

                L += beta * new_material.Ke * brdf
                    * dot(light_normal, -light_direction.xyz) 
                    * dot(cur_normal.xyz, light_direction.xyz) 
                    / attenuated_distance
                    * sample_area_light_mc_term;
            }
            
            if(direct_lighting_only){
                break;
            }
        }

        // russian roulette term
        seed = hash1u(seed + 7u);
        let rr_continue = hash1(seed);
        if(rr_continue > rr_prob){ // don't continue
            break;
        }

        ///////////////////////////
        // BRDF LOGIC
        ///////////////////////////

        var fresnel_chose_reflect = false;
        // refraction + fresnel effect
        if(cur_material.illum == 7.0){
            let w_i = ray.d.xyz;
            let n_hat = cur_normal.xyz;

            var eta_i = 1.0;
            var eta_t = 2.5; // from the obj file... too lazy to change obj parsing again
            var cos_i = clamp(dot(w_i, n_hat), -1.0, 1.0);
            var n = n_hat;

            if(cos_i < 0){
                cos_i = -cos_i;
            } else {
                eta_i = 2.5;
                eta_t = 1.0;
                n = -n;
            }

            // calculate schlick's approximation here
            let r_0 = ((eta_i - eta_t) / (eta_i + eta_t)) * ((eta_i - eta_t) / (eta_i + eta_t));
            let r_theta = r_0 + (1.0 - r_0) * pow(1.0 - cos_i, 5.0);
            seed = hash1u(seed + 7u);
            let should_reflect = hash1(seed);
            if(should_reflect < r_theta){
                fresnel_chose_reflect = true;
            } else {
                let ratio_eta = eta_i / eta_t;
                let k = 1.0 - ratio_eta * ratio_eta * (1.0 - cos_i * cos_i);
                let new_direction = ratio_eta * w_i + (ratio_eta * cos_i - sqrt(clamp(k, 0.0, 1.0))) * n; // TODO: fix clamping with actual sqrt(-1) effect
                let new_ray = ray_with_epsilon(cur_pt, vec4(new_direction, 0.0));

                hit_specular = true;

                beta *= 1.0 / rr_prob;        
                ray = new_ray;
                depth += 1;
                continue;
            }
        }

        // handle reflective (mirror) material
        if(cur_material.Ns > 500 || fresnel_chose_reflect){
            let w_i = ray.d.xyz;
            let n_hat = cur_normal.xyz;
            let refl = vec4(w_i - 2*dot(w_i, n_hat) * n_hat, 0.0);
            let new_ray = ray_with_epsilon(cur_pt, refl);
            
            hit_specular = true;

            beta *= 1.0 / rr_prob;        
            ray = new_ray;
            depth += 1;
            continue;
        }

        seed = hash1u(seed);
        let sample = sample_hemisphere(cur_pt, cur_normal, i32(seed), use_importance_sampling);
        let new_ray = sample.r;
        let new_pdf = sample.pdf;
        var brdf = vec3(0.0);
        let enable_beckmann = use_microfacet;

        // glossy specular / phong brdf
        if(dot(cur_material.Ks, vec3f(1.0)) > 0){
            let w_i = ray.d.xyz;
            let w_o = new_ray.d.xyz;
            let n_hat = cur_normal.xyz;
            let refl = w_i  - 2*dot(w_i, n_hat) * n_hat;
            let n = cur_material.Ns;

            let q = dot(refl, w_o);
            if(q < 0.0){
                brdf = vec3(0.0);
            } else {
                let pow_factor = pow(dot(refl, w_o), n);
                let scaling_factor: f32 = ((n + 2.0) / (2.0 * PI)) * pow_factor;
                brdf = cur_material.Ks * scaling_factor;
                if(depth == 0){ hit_specular = true; }
            }
        } 

        // beckmann brdf
        else if(enable_beckmann){
            let alpha = 1.0;
            let s = -ray.d.xyz;
            let n = cur_normal.xyz;
            let h = normalize(s + n);
            let delta = acos(dot(h, n));
            let D = exp(-tan(delta) * tan(delta) / alpha / alpha) 
                / (PI * alpha * alpha * pow(cos(delta), 4.0));
            brdf = D * cur_material.Kd;
        }

        // lambertian / diffuse brdf
        else {
            brdf = cur_material.Kd / PI;
        }
        
        beta *= brdf * dot(new_ray.d, cur_normal) / (new_pdf * rr_prob);
        ray = new_ray;
        depth += 1;
    }

    return L;
}

`;