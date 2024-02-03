#include wgsl-util/data-structs.wgsl 
#include primitive.wgsl 
#include wgsl-util/hash.wgsl 
#include wgsl-util/samplers.wgsl 

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
@group(0) @binding(2) var<storage, read> primitives : array<Primitive>;

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

fn radiance(ray: Ray, seed: i32) -> vec3f {
    var cur_ray = ray;
    var total_color = vec3(0.0);
    var weight = 1.0;
    var normal_mode = false;

    for(var j = 0; j < 4; j++){
        var closest_intersection = null_intersection();
        var prev_intersection = null_intersection();
        var closest_t = -1.0;
        var cur_color = vec3(0.0);

        for(var i = 0u; i < arrayLength(&primitives); i++){
            let cur_primitive = primitives[i];
            let ctm_inv = cur_primitive.ctm_inv;
            let trans_ray = Ray(ctm_inv * cur_ray.p, ctm_inv * cur_ray.d);

            var intersection = null_intersection();
            if(cur_primitive.kind_material.x == 0){
                intersection = intersect_unit_cube(cur_primitive, trans_ray);
            } else if(cur_primitive.kind_material.x == 1){
                intersection = intersect_unit_sphere(cur_primitive, trans_ray);
            }

            if(intersection.intersected){
                if(closest_t < 0 || intersection.t < closest_t){
                    closest_intersection = intersection;
                    closest_t = intersection.t;

                    closest_intersection.point = cur_primitive.ctm * closest_intersection.point;
                    let new_normal = (cur_primitive.ctm * vec4<f32>(closest_intersection.normal.xyz, 0.0));
                    closest_intersection.normal = normalize(new_normal);
                }
            }
        }

        // return if no intersection
        if(!closest_intersection.intersected){ break; }
        // we have an intersection, proceed!


        // calculate L_e term (emissive material struck!)
        if(closest_intersection.primitive.temp.y == 1.0){
            cur_color += closest_intersection.primitive.kind_material.yzw;

            total_color += cur_color * weight;

            break;
        }

        // calculate reflectance term!
        let cur_ray_sample = sample_hemisphere(closest_intersection.point, closest_intersection.normal, seed);

        cur_ray = cur_ray_sample.r; 
        let pdf = cur_ray_sample.pdf;

        weight = (1.0 / PI) * (dot(cur_ray.d, closest_intersection.normal)) / pdf;

        prev_intersection = closest_intersection;
    }

    return total_color;
}

