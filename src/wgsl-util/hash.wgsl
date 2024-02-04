fn hash1(_n: u32) -> f32 {
    var n = _n;
    let t = meta_data.aspect_and_time[1];

	n = (n << 13u) ^ n;
    n = n * (n * n * 15731u + 789221u + u32(t)) + 1376312589u;
    return 1.0 - f32(n & 0x7fffffffu) / f32(0x7fffffff);
}

fn hash2(_n: u32) -> vec2f {
    var n = _n;
    let t = meta_data.aspect_and_time[1];

	n = (n << 13u) ^ n;
    n = n * (n * n * 15731u + 789221u + u32(t)) + 1376312589u;
    let k = n * vec2(n, n*16807u);

    return vec2f(k & vec2(0x7fffffffu)) / f32(0x7fffffff);
}

fn ihash1(_n: u32) -> u32 {
    var n = _n;
	n = (n << 13u) ^ n;
    n = n * (n * n * 15731u + 789221u) + 1376312589u;
    return n;
}
