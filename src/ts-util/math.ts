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