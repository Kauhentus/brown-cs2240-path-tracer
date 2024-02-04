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

fn radiance(ray: Ray, seed: i32) -> vec3f {
    var cur_ray = ray;
    var total_color = vec3(0.0);
    var weight = 1.0;
    var normal_mode = false;
    var prev_intersection = null_intersection();

    for(var j = 0; j < 2; j++){
        var closest_intersection = intersect(cur_ray);
        var cur_color = vec3(0.0);

        if(!closest_intersection.intersected){ break; }
        if(normal_mode){ total_color = (normalize(closest_intersection.normal.xyz) + 1.0) * 0.5; break; }

        total_color = vec3(f32(closest_intersection.material_id) * 0.1);
        break;

        // calculate L_e term (emissive material struck!)
        // if(closest_intersection.primitive.temp.y == 1.0){
        //     cur_color += closest_intersection.primitive.kind_material.yzw;
        //     total_color += cur_color * weight;
        //     break;
        // }

        // calculate reflectance term!
        let cur_ray_sample = sample_hemisphere(closest_intersection.point, closest_intersection.normal, seed);
        cur_ray = cur_ray_sample.r; 
        let pdf = cur_ray_sample.pdf;
        weight = (1.0 / PI) * (dot(cur_ray.d, closest_intersection.normal)) / pdf;
        prev_intersection = closest_intersection;
    }

    return total_color;
}

