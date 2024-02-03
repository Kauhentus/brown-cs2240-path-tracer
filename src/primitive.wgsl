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

fn null_intersection() -> PrimitiveIntersection {
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
        return null_intersection();
    }
}

fn intersect_unit_sphere(primitive: Primitive, r: Ray) -> PrimitiveIntersection {
    let A = r.d.x * r.d.x + r.d.y * r.d.y + r.d.z * r.d.z;
    let B = 2.0f * r.d.x * r.p.x
            + 2.0f * r.d.y * r.p.y
            + 2.0f * r.d.z * r.p.z;
    let C = r.p.x * r.p.x + r.p.y * r.p.y + r.p.z * r.p.z - 0.5 * 0.5;
    let discr = B * B - 4 * A * C;
    if(discr < 0) { return null_intersection(); }

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
