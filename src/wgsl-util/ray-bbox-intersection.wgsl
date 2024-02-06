fn ray_bbox_intersection(r: Ray, min_corner: vec3f, max_corner: vec3f) -> bool {
    var tmin = -3.0e+38;
    var tmax = 3.0e+38;

    let t1x = (min_corner.x - r.p.x) * (1.0 / r.d.x);
    let t2x = (max_corner.x - r.p.x) * (1.0 / r.d.x);
    tmin = max(tmin, min(t1x, t2x));
    tmax = min(tmax, max(t1x, t2x));

    let t1y = (min_corner.y - r.p.y) * (1.0 / r.d.y);
    let t2y = (max_corner.y - r.p.y) * (1.0 / r.d.y);
    tmin = max(tmin, min(t1y, t2y));
    tmax = min(tmax, max(t1y, t2y));

    let t1z = (min_corner.z - r.p.z) * (1.0 / r.d.z);
    let t2z = (max_corner.z - r.p.z) * (1.0 / r.d.z);
    tmin = max(tmin, min(t1z, t2z));
    tmax = min(tmax, max(t1z, t2z));

    // if(tmax > max(tmin, 0.0f)){
    //     if(tmin > 0.0 && tmin < tmax){
    //         return tmin;
    //     } else {
    //         return tmax;
    //     }
    // } else {
    //     return -1.0;
    // }
    return tmax > max(tmin, 0.0f);
}

fn ray_bbox_intersection_fast(r: Ray, min_corner: vec3f, max_corner: vec3f) -> f32 {
    // faster ray-box intersection from https://tavianator.com/2015/ray_box_nan.html
    var tmin = -3.0e+38;
    var tmax = 3.0e+38;

    let t1x = (min_corner.x - r.p.x) * (1.0 / r.d.x);
    let t2x = (max_corner.x - r.p.x) * (1.0 / r.d.x);
    tmin = max(tmin, min(t1x, t2x));
    tmax = min(tmax, max(t1x, t2x));

    let t1y = (min_corner.y - r.p.y) * (1.0 / r.d.y);
    let t2y = (max_corner.y - r.p.y) * (1.0 / r.d.y);
    tmin = max(tmin, min(t1y, t2y));
    tmax = min(tmax, max(t1y, t2y));

    let t1z = (min_corner.z - r.p.z) * (1.0 / r.d.z);
    let t2z = (max_corner.z - r.p.z) * (1.0 / r.d.z);
    tmin = max(tmin, min(t1z, t2z));
    tmax = min(tmax, max(t1z, t2z));

    if(tmax > max(tmin, 0.0f)){
        return tmin;
    } else {
        return -1.0;
    }
}