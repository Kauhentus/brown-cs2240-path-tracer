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