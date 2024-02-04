#include wgsl-util/data-structs.wgsl 
#include primitive.wgsl 
#include wgsl-util/hash.wgsl 
#include wgsl-util/samplers.wgsl 
#include wgsl-util/triangle-intersection.wgsl 

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
    numbers: array<u32>,
}

@group(0) @binding(0) var<storage, read> meta_data : MetaData;
@group(0) @binding(1) var<storage, read_write> resultMatrix : OutputData;

@group(0) @binding(3) var<storage, read> primitive_0 : array<f32>;

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
    let num_samples = 32;
    for(var i = 0; i < num_samples; i++){
        let p_pixel = vec4(view_plane_x, view_plane_y, -focal_length, 1.0f);
        let p_pixelv = cam_to_world * p_pixel;
        let direction = normalize(p_pixelv - camera_pos);
        var ray_world = Ray(camera_pos, direction);

        var color = radiance(ray_world, i + i32(index * 100));
        total_color += color;
    }
    total_color *= 1.0 / f32(num_samples);

    let r: u32 = u32(total_color.x * 255);
    let g: u32 = u32(total_color.y * 255);
    let b: u32 = u32(total_color.z * 255);
    let final_color = (255 << 24) + (b << 16) + (g << 8) + r;

    resultMatrix.numbers[index] = final_color;
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
    let num_vertices = primitive_0[0];
    let num_objects = primitive_0[1];

    let v_start = i32(primitive_0[2]);
    let o_start = i32(primitive_0[3]);
    let m_start = i32(primitive_0[4]);
    let v_start_offset = v_start;

    var closest_intersection = null_intersection();
    var closest_t = -1.0;

    for(var i = o_start; i < m_start; i += 4){
        let i0 = (i32(primitive_0[i]) - 1) * 3;
        let i1 = (i32(primitive_0[i + 1]) - 1) * 3;
        let i2 = (i32(primitive_0[i + 2]) - 1) * 3;

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

                closest_intersection.material_id = i32(primitive_0[i + 3]);
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

fn radiance(_ray: Ray, seed: i32) -> vec3f {
    var L = vec3(0.0);
    var beta = 1.0;
    var depth = 0;
    var ray = _ray;

    while(beta > 0.1 && depth <= 4){
        var closest_intersection = intersect(ray);
        if(!closest_intersection.intersected){
            break;
        }

        let cur_material = get_material(closest_intersection.material_id);
        let cur_normal = closest_intersection.normal;
        let cur_pt = closest_intersection.point;

        // calculate emissive contribution
        if(dot(cur_material.Ke, vec3f(1.0)) > 0){ 
            L += beta * cur_material.Ke;
        }

        // TODO: sample lights for direct illumination
        // let light_direction = normalize(vec3(1, 1, 1));
        // let to_light_test = intersect(ray_with_epsilon(cur_pt + cur_normal * 1.0e-2, vec4(light_direction, 0.0)));
        // if(!to_light_test.intersected){
        //     L += beta * cur_material.Kd * vec3(1.0, 0.95, 0.9);
        // }
        let offset_pt = cur_pt + cur_normal * 1.0e-2;
        let light_direction = sample_area_lights(offset_pt.xyz, seed);
        let to_light_test = intersect(ray_with_epsilon(offset_pt, vec4(light_direction, 0.0)));
        if(to_light_test.intersected){
            let new_material = get_material(to_light_test.material_id);
            if(dot(new_material.Ke, vec3f(1.0)) > 0){ 
                L += beta * cur_material.Kd * dot(cur_normal.xyz, light_direction) * 0.5;
            }
        }

        // sample outgoing direction to continue path
        let sample = sample_hemisphere(cur_pt, cur_normal, seed);
        let new_ray = sample.r;
        let new_pdf = sample.pdf;

        beta *= dot(new_ray.d, cur_normal);
        if(dot(new_ray.d, cur_normal) < 0.0){
            // return vec3(0.0);
        }
        ray = new_ray;
        depth += 1;
    }

    return L;
}

