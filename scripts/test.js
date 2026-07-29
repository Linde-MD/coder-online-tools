let text = "The rain in SPAIN stays mainly in the plain";
let result = text.match(/in/g);
console.log(result)
console.log(result.length)

let a = 1.01;
const b = 0.0;
let value = 1;
for (let i = 0; i < 40; i++) {
    a += b;
    value *= a;
}

console.log(a, value)