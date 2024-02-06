import { Bounds, Vertex } from "@toysinbox3dprinting/js-geometry";

export const mat4_rot_axis = (x: number, y: number, z: number, theta: number) => {
    const ct = Math.cos(theta);
    const st = Math.sin(theta);
    return [
        ct + x*x * (1 - ct), x*y * (1 - ct) + z*st, x*z * (1 - ct) - y*st, 0,
        x*y * (1 - ct) - z*st, ct + y*y * (1 - ct), y*z * (1 - ct) + x*st, 0,
        x*z * (1 - ct) + y*st, y*z * (1 - ct) - x*st, ct + z*z * (1 - ct), 0,
        0, 0, 0, 1
    ];
}

export const bounds_of_vec3 = (vertices: number[][]): Bounds => {
    let min = vertices[0].slice(0);
    let max = vertices[0].slice(0);

    for(let v of vertices){
        if(v[0] <= min[0]) min[0] = v[0];
        if(v[0] >= max[0]) max[0] = v[0];

        if(v[1] <= min[1]) min[1] = v[1];
        if(v[1] >= max[1]) max[1] = v[1];

        if(v[2] <= min[2]) min[2] = v[2];
        if(v[2] >= max[2]) max[2] = v[2];
    }


    return new Bounds(
        new Vertex(min[0], min[1], min[2]),
        new Vertex(max[0], max[1], max[2])
    );
}

export const chunk_into_3 = <T>(array: T[]): T[][] => {
    if(array.length % 3 !== 0) throw Error('Attempted to chunk non-3 multiple length array into 3\'s');
    let result: T[][] = [];
    for(let i = 0; i < array.length; i += 3){
        result.push([array[i], array[i + 1], array[i + 2]]);
    }
    return result;
}