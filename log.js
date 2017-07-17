var colors = require('colors/safe');
loglevel = 2;

// ok this is kind of gross. :) But it lets us do `var log = require ('./log')(2);`
module.exports = function(level) {
    if (level !== undefined)
        loglevel = level;
    return module.exports;
};

module.exports.setLevel = module.exports;

module.exports.debug = function(message) {
    if (typeof message === 'object')
        message = JSON.stringify(message);
    if (loglevel <= 0)
        console.log(colors.dim.italic(message));
};


module.exports.low = function(message) {
    if (loglevel <= 1)
        console.log(colors.grey(message));
};

module.exports.medium = function(message) {
    if (loglevel <= 2)
        console.log(colors.green(message));
    //console.log(message);
};

module.exports.high = function(message) {
    if (loglevel <= 3)
    console.log(colors.cyan(message));
    //console.log(message);
};

module.exports.warn = function(message) {
    if (loglevel <= 3)
        console.error(colors.yellow.bold(message));
};

module.exports.error = function(message) {
    console.error(colors.red.bold(message));
};

