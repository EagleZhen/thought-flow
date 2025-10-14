export function b() {
    console.log('b');
}

export function c() {
    b();
}

export function a() {
    b();
    c();
}
