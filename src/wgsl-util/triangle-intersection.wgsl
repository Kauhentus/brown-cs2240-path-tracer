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

    if (u < 0 || u > 1){
        return null_intersection();
    }

    let s_cross_e1 = cross(s, edge1);
    let v = inv_det * dot(ray_vector, s_cross_e1);

    if (v < 0 || u + v > 1){
        return null_intersection();
    }

    let t = inv_det * dot(edge2, s_cross_e1);

    if (t > epsilon) {
        let out_intersection_point = ray_origin + ray_vector * t;
        return Intersection(
            vec4(out_intersection_point, 1.0), 
            vec4(cross(edge1, edge2), 0.0), 
            true, t, 0
        );
    } else {
        return null_intersection();
    }
}