/* jshint esnext:true */
var options = require('command-line-args')([
    { name: 'file', type: String, multiple: true, defaultOption: true }
]);
var colors = require('colors');
console.log('./out-geojsons/' + options.file[0] + '.geojson');
var geo = require('json-file').read('./out-geojsons/' + options.file[0] + '.geojson').data;
geo.features.forEach(feature => {
    try {
        var coords = feature.geometry.coordinates;
        if (coords[0] >= 180 || coords[0] <= -180 || coords[1] >= 90 || coords[1] <= -90) {
            console.log(feature.properties.sourceUrl.red);
            //console.log(feature.geometry);
        }
    } catch(e) {
        console.error(feature.properties.sourceUrl.red);
        //console.log(feature.
    }
});

    