let f1 = n => {
    if(n <= 0) return 1;
    return n * f1(n - 1);
}

let f2 = (n, a = 1) => {
    if(n <= 0) return a;
    return f2(n - 1, n * a)
}

let f3 = (n, a = 1) => {
    while(n > 0){
        a = n * a;
        n = n - 1;
    }
    return a;
}

console.log(f1(8));
console.log(f2(8));
console.log(f3(8));