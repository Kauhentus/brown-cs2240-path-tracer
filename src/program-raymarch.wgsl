#include wgsl-util/data-structs.wgsl 
#include primitive.wgsl 
#include wgsl-util/hash.wgsl 
#include wgsl-util/samplers.wgsl 
#include wgsl-util/ray-triangle-intersection.wgsl 
#include wgsl-util/ray-bbox-intersection.wgsl 
#include wgsl-util/intersection-logic.wgsl

const PI = 3.14159;

struct MetaData {
    resolution: vec2f,
    camera_data: vec2f,
    camera_pos: vec4f,

    resolution_inv: vec2f,
    aspect_and_time: vec2f,

    world_to_cam: mat4x4<f32>,
    cam_to_world: mat4x4<f32>,
    params: vec4f
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

fn radiance(_ray: Ray, _seed: i32) -> vec3f {
    var L = vec3(0.0);
    var acc_color = vec3(1.0);
    var beta = vec3(1.0);
    let rr_prob = meta_data.params[1];
    let direct_lighting_only = meta_data.params[2] > 0;

    var depth = 0;
    var ray = _ray;
    var hit_specular = false;

    var seed = hash1u(u32(_seed));
    seed = hash1u(seed);

    while(depth <= 16){
        //////////////////////
        // SAMPLING LOGIC
        //////////////////////

        seed = hash1u(seed);
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
        let sample_area_light_output = sample_area_lights(offset_pt.xyz, i32(seed));
        let light_direction = vec4(sample_area_light_output.xyz, 0.0);
        let sample_area_light_mc_term = sample_area_light_output.w;
        seed = hash1u(seed + 7u);
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

        let sample = sample_hemisphere(cur_pt, cur_normal, i32(seed));
        let new_ray = sample.r;
        let new_pdf = sample.pdf;
        var brdf = vec3(0.0);
        let enable_beckmann = false;

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

