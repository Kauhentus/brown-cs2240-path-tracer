#include wgsl-util/data-structs.wgsl 
#include primitive.wgsl 
#include wgsl-util/hash.wgsl 
#include wgsl-util/samplers.wgsl 
#include wgsl-util/ray-triangle-intersection.wgsl 
#include wgsl-util/ray-bbox-intersection.wgsl 

const PI = 3.14159;

struct MetaData {
    resolution: vec2f,
    camera_data: vec2f,
    camera_pos: vec4f,

    resolution_inv: vec2f,
    aspect_and_time: vec2f,

    world_to_cam: mat4x4<f32>,
    cam_to_world: mat4x4<f32>,
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

    let gx = f32(global_id.x);
    let gy = f32(global_id.y);
    let index = (global_id.x + global_id.y * u32(size.x)) * 1;

    let norm_x = (gx + 0.5f) * size_inv.x - 0.5f;
    let norm_y = (size.y - 1.f - gy + 0.5f) * size_inv.y - 0.5f;
    let view_half_h = 2.f * focal_length * tan(v_fov * 0.5);
    let view_half_w = view_half_h * aspect_ratio;
    let view_plane_x = view_half_w * norm_x;
    let view_plane_y = view_half_h * norm_y;

    var total_color = vec3(0.0, 0.0, 0.0);
    let num_samples = 8;
    for(var i = 0; i < num_samples; i++){
        let p_pixel = vec4(view_plane_x, view_plane_y, -focal_length, 1.0f);
        let p_pixelv = cam_to_world * p_pixel;
        let direction = normalize(p_pixelv - camera_pos);
        var ray_world = Ray(camera_pos, direction);

        var color = radiance(ray_world, i + i32(index * 67));
        total_color += color;
    }
    total_color *= 1.0 / f32(num_samples);

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

fn intersect(cur_ray: Ray) -> Intersection {
    // first intersect BVH to find candidate triangles
    var cur_min = vec3(bvh_0[0], bvh_0[1], bvh_0[2]);
    var cur_max = vec3(bvh_0[3], bvh_0[4], bvh_0[5]);
    var cur_depth = 0;

    var stack = array( 
        6, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
    );
    var stack_pointer = 0;
    var bounds_stack = array( 
        cur_min.x, cur_min.y, cur_min.z, cur_max.x, cur_max.y, cur_max.z,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,

        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,

        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,

        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
    );
    var bounds_stack_pointer = 0;

    var leaf_flags = array( 
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
    );
    var num_leaves = 0;

    while(stack_pointer > -1 && cur_depth < 256){
        let pointer = stack[stack_pointer];
        let cur_is_leaf = bvh_0[pointer] == 1;
        let cur_axis = bvh_0[pointer + 1];

        let left_min = vec3f(
            bounds_stack[bounds_stack_pointer * 6],
            bounds_stack[bounds_stack_pointer * 6 + 1],
            bounds_stack[bounds_stack_pointer * 6 + 2],
        );
        let right_max = vec3f(
            bounds_stack[bounds_stack_pointer * 6 + 3],
            bounds_stack[bounds_stack_pointer * 6 + 4],
            bounds_stack[bounds_stack_pointer * 6 + 5],
        );
        // let left_min = cur_min;
        // let right_max = cur_max;
        
        let left_max = select(
            vec3((left_min.x + right_max.x) * 0.5, right_max.y, right_max.z),
            select(
                vec3(right_max.x, (left_min.y + right_max.y) * 0.5, right_max.z),
                vec3(right_max.x, right_max.y, (left_min.z + right_max.z) * 0.5),
                cur_axis == 1.0
            ),
            cur_axis == 0.0
        );
        let right_min = select(
            vec3((left_min.x + right_max.x) * 0.5, left_min.y, left_min.z),
            select(
                vec3(left_min.x, (left_min.y + right_max.y) * 0.5, left_min.z),
                vec3(left_min.x, left_min.y, (left_min.z + right_max.z) * 0.5),
                cur_axis == 1.0
            ),
            cur_axis == 0.0
        );

        var left_intersect = ray_bbox_intersection(cur_ray, left_min, left_max);
        var right_intersect = ray_bbox_intersection(cur_ray, right_min, right_max);
        left_intersect = true;
        right_intersect = true;

        var left_overlaps = false;
        var left_is_leaf = false;
        var right_overlaps = false;
        var right_is_leaf = false;

        if(left_intersect){
            left_overlaps = true;
            let left_pointer = i32(bvh_0[pointer + 2]);
            let is_leaf = bvh_0[left_pointer] == 1;

            if(is_leaf){
                left_is_leaf = true;
                leaf_flags[num_leaves] = left_pointer;
                num_leaves += 1;
            }
        }

        if(right_intersect){
            right_overlaps = true;
            let right_pointer = i32(bvh_0[pointer + 3]);
            let is_leaf = bvh_0[right_pointer] == 1;

            if(is_leaf){
                right_is_leaf = true;
                leaf_flags[num_leaves] = right_pointer;
                num_leaves += 1;
            }
        }

        let traverse_left = left_overlaps && !left_is_leaf;
        let traverse_right = right_overlaps && !right_is_leaf;

        if(!traverse_left && !traverse_right){
            stack_pointer -= 1;
            bounds_stack_pointer -= 1;
            if(stack_pointer < 0){ break; }
                
            while(stack[stack_pointer] == -1){
                stack_pointer -= 1;
                bounds_stack_pointer -= 1;
                if(stack_pointer < 0){ break; }
            }
        } else {
            stack[stack_pointer] = -1; 

            if(traverse_left && !traverse_right){
                stack_pointer += 1;
                stack[stack_pointer] = i32(bvh_0[pointer + 2]);

                bounds_stack_pointer += 1;
                bounds_stack[bounds_stack_pointer * 6] = left_min.x;
                bounds_stack[bounds_stack_pointer * 6 + 1] = left_min.y;
                bounds_stack[bounds_stack_pointer * 6 + 2] = left_min.z;
                bounds_stack[bounds_stack_pointer * 6 + 3] = left_max.x;
                bounds_stack[bounds_stack_pointer * 6 + 4] = left_max.y;
                bounds_stack[bounds_stack_pointer * 6 + 5] = left_max.z;
            } 
            
            else if(!traverse_left && traverse_right){
                stack_pointer += 1;
                stack[stack_pointer] = i32(bvh_0[pointer + 3]);

                bounds_stack_pointer += 1;
                bounds_stack[bounds_stack_pointer * 6] = right_min.x;
                bounds_stack[bounds_stack_pointer * 6 + 1] = right_min.y;
                bounds_stack[bounds_stack_pointer * 6 + 2] = right_min.z;
                bounds_stack[bounds_stack_pointer * 6 + 3] = right_max.x;
                bounds_stack[bounds_stack_pointer * 6 + 4] = right_max.y;
                bounds_stack[bounds_stack_pointer * 6 + 5] = right_max.z;
            } 
            
            else { // traverse both
                stack_pointer += 1;
                stack[stack_pointer] = i32(bvh_0[pointer + 2]);
                stack_pointer += 1;
                stack[stack_pointer] = i32(bvh_0[pointer + 3]);

                bounds_stack_pointer += 1;
                bounds_stack[bounds_stack_pointer * 6] = left_min.x;
                bounds_stack[bounds_stack_pointer * 6 + 1] = left_min.y;
                bounds_stack[bounds_stack_pointer * 6 + 2] = left_min.z;
                bounds_stack[bounds_stack_pointer * 6 + 3] = left_max.x;
                bounds_stack[bounds_stack_pointer * 6 + 4] = left_max.y;
                bounds_stack[bounds_stack_pointer * 6 + 5] = left_max.z;

                bounds_stack_pointer += 1;
                bounds_stack[bounds_stack_pointer * 6] = right_min.x;
                bounds_stack[bounds_stack_pointer * 6 + 1] = right_min.y;
                bounds_stack[bounds_stack_pointer * 6 + 2] = right_min.z;
                bounds_stack[bounds_stack_pointer * 6 + 3] = right_max.x;
                bounds_stack[bounds_stack_pointer * 6 + 4] = right_max.y;
                bounds_stack[bounds_stack_pointer * 6 + 5] = right_max.z;
            }
        }

        cur_depth += 1;
    }

    // if(stack_pointer == -1) { return null_intersection(); }
    // if(cur_depth > 2) { return null_intersection(); }
    if(cur_depth == 255) { return null_intersection(); }
    // if(num_leaves == 4) { return null_intersection(); }

    let num_vertices = primitive_0[0];
    let num_objects = primitive_0[1];

    var closest_intersection = null_intersection();
    var closest_t = -1.0;

    for(var n = 0; n < num_leaves; n++){
        let pointer = leaf_flags[n];
        let num_triangles = bvh_0[pointer + 4];
        let bvh_o_start = pointer + 5;
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

            var intersection = ray_triangle_intersection(
                cur_ray, v0, v1, v2
            );

            if(intersection.intersected){
                if(closest_t < 0 || intersection.t < closest_t){
                    closest_intersection = intersection;
                    closest_t = intersection.t;

                    closest_intersection.material_id = i32(bvh_0[i + 3]);
                }
            }
        }
    }

    return closest_intersection;
}

fn sample_area_lights(x: vec3f, seed: i32) -> vec3f {
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
    return direction;
}

fn radiance(_ray: Ray, _seed: i32) -> vec3f {
    var L = vec3(0.0);
    var acc_color = vec3(1.0);
    var beta = 1.0;
    let rr_prob = 0.9;

    var depth = 0;
    var ray = _ray;

    var seed = hash1u(u32(_seed));
    seed = hash1u(seed);

    while(beta > 0.1 && depth <= 16){
        seed = hash1u(seed);

        var closest_intersection = intersect(ray);
        if(!closest_intersection.intersected){
            break;
        }
        
        let cur_material = get_material(closest_intersection.material_id);
        let cur_normal = closest_intersection.normal;
        let cur_pt = closest_intersection.point;

        // calculate emissive contribution
        if(dot(cur_material.Ke, vec3f(1.0)) > 0){ 
            L += beta * cur_material.Ke * acc_color;
            break;
        }
    
        acc_color *= cur_material.Kd;

        // TODO: sample lights for direct illumination
        // let light_direction = normalize(vec3(1, 1, 1));
        // let to_light_test = intersect(ray_with_epsilon(cur_pt + cur_normal * 1.0e-2, vec4(light_direction, 0.0)));
        // if(!to_light_test.intersected){
        //     L += beta * cur_material.Kd * vec3(1.0, 0.95, 0.9);
        // }
        // let offset_pt = cur_pt + cur_normal * 1.0e-2;
        // let light_direction = sample_area_lights(offset_pt.xyz, seed);
        // let to_light_test = intersect(ray_with_epsilon(offset_pt, vec4(light_direction, 0.0)));
        // if(to_light_test.intersected){
        //     let new_material = get_material(to_light_test.material_id);
        //     if(dot(new_material.Ke, vec3f(1.0)) > 0){ 
        //         L += beta * cur_material.Kd * dot(cur_normal.xyz, light_direction) * 0.5;
        //     }
        // }

        let rr_continue = hash1(seed);
        if(rr_continue > rr_prob){ // don't continue
            break;
        }

        // sample outgoing direction to continue path
        let sample = sample_hemisphere(cur_pt, cur_normal, i32(seed));
        let new_ray = sample.r;
        let new_pdf = sample.pdf;

        beta *= (1.0 / PI) * dot(new_ray.d, cur_normal) / (new_pdf * rr_prob);
        ray = new_ray;
        depth += 1;
    }

    return L;
}

