/** Tools */

const numDico = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const hexaDico = [...numDico, "A", "B", "C", "D", "E", "F"];
const alphaDico = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
];
const supportedSpecialCharsDico = ["-", "+", "_", "=", "[", "]", "*", "$", "@"];

function generateInt(min = 6, max = 64) {
  if (
    typeof min !== "number" ||
    !Number.isInteger(min) ||
    typeof max !== "number" ||
    !Number.isInteger(max) ||
    max <= min
  ) {
    throw new Error("min and max parameters must be integers.");
  }
  return min + Math.floor(Math.random() * (max - min));
}

/**
 * @returns { string }
 */
function generateKey(/** @type { number } */ length) {
  if (!length) {
    return generateKey(generateInt());
  }
  if (typeof length !== "number" || !Number.isInteger(length) || length <= 0) {
    throw new Error("length must be a positive integer.");
  }
  const dico = [...alphaDico, ...numDico, ...supportedSpecialCharsDico];
  let result = "";
  for (var i = 0; i < length; i++) {
    result += dico[Math.floor(Math.random() * (dico.length - 1))];
  }
  return result;
}

/**
 * @returns { string }
 */
function generateColor() {
  let result = "";
  for (var i = 0; i < 6; i++) {
    result += hexaDico[Math.floor(Math.random() * (hexaDico.length - 1))];
  }
  return "#" + result;
}

/**
 * @returns { Promise<JSON | string> }
 */
function parseBody(/** @type { import("http").IncomingMessage } */ req) {
  return new Promise((resolve, reject) => {
    req.on("data", (chunk) => {
      const str = Buffer.from(chunk).toString("utf-8");
      if (req.headers["content-type"] === "application/json") {
        const json = parseValue(JSON.parse(str));
        resolve(json);
      } else {
        resolve(str);
      }
    });
  });
}

function parseValue(value) {
  if (typeof value !== "object") {
    return value;
  }
  const output = {};
  const keys = Object.keys(value);
  for (let k of keys) {
    output[k] = parseValue(value[k]);
  }
  return output;
}

/**
 * @returns { Record<string, string }
 */
function parseQueryParams(/** @type { import("http").IncomingMessage } */ req) {
  const [_, q] = req.url.split("?");
  return q
    .split("&")
    .map((pair) => pair.split("="))
    .reduce((acc, curr) => {
      const [key, value, ..._] = curr;
      acc[key] = value;
      return acc;
    }, {});
}

/**
 * 
 * @param {{ notificationName: string; payload: any; }} options 
 * @returns { string }
 */
function generateNotification(options) {
  return (
    "event: " +
    options.notificationName +
    "\n" +
    "data: " +
    JSON.stringify(options.payload) +
    "\n\n"
  );
}

function successResponse(result) {
  return JSON.stringify({ result });
}

function errorResponse(error) {
  return JSON.stringify({ error });
}

exports.generateInt = generateInt;
exports.generateKey = generateKey;
exports.generateColor = generateColor;
exports.parseBody = parseBody;
exports.parseValue = parseValue;
exports.parseQueryParams = parseQueryParams;
exports.generateNotification = generateNotification;
exports.successResponse = successResponse;
exports.errorResponse = errorResponse;