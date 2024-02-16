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

                    var intersection: Intersection;

                    // if(i2 < vn_range){
                    //     let v0n = vec3f(
                    //         primitive_0[vn_start_offset + i0], 
                    //         primitive_0[vn_start_offset + i0 + 1], 
                    //         primitive_0[vn_start_offset + i0 + 2], 
                    //     );
                    //     let v1n = vec3f(
                    //         primitive_0[vn_start_offset + i1], 
                    //         primitive_0[vn_start_offset + i1 + 1], 
                    //         primitive_0[vn_start_offset + i1 + 2], 
                    //     );
                    //     let v2n = vec3f(
                    //         primitive_0[vn_start_offset + i2], 
                    //         primitive_0[vn_start_offset + i2 + 1], 
                    //         primitive_0[vn_start_offset + i2 + 2], 
                    //     );

                    //     intersection = ray_triangle_intersection_vertex_normals(
                    //         cur_ray, v0, v1, v2,
                    //         v0n, v1n, v2n
                    //     );
                    // }
    
                    // else {
                    //     intersection = ray_triangle_intersection(
                    //         cur_ray, v0, v1, v2
                    //     );
                    // }

                    intersection = ray_triangle_intersection(
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

    // if(stack_pointer == -1) { return null_intersection(); }
    // if(cur_depth > 2) { return null_intersection(); }
    // if(num_tri_ints > 1000) { return null_intersection(); }
    // if(num_leaves == 8) { return Intersection(vec4(1.0), vec4(1.0), true, 1.0, 7); }
    // return Intersection(vec4(1.0), vec4(1.0), true, 1.0, 7);

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
    return vec4(direction, 0.0);
}
