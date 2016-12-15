/* jshint esnext:true */
var options = require('command-line-args')([
    { name: 'file', type: String, multiple: true, defaultOption: true }
]);
var colors = require('colors');
var geo = require('geojson-flatten')(require('json-file').read('./out-geojsons/' + options.file[0] + '.geojson').data);

function checkCoords(coords, source) {
    //console.log(coords);
    try {
        //if (coords[0] >= 180 || coords[0] <= -180 || coords[1] >= 90 || coords[1] <= -90) {
        if (coords[0] >= 150 || coords[0] <= 90 || coords[1] >= -20 || coords[1] <= -40) {
            console.log(source.blue);
            //console.log(feature.geometry);
        }
    } catch(e) {
        console.error(source.red);
        //console.log(feature.
    }
}

/*
geo.features.forEach(feature => {
    if (feature.type.toLowerCase() ==='multipolygon') {

        feature.geometry.coordinates.forEach(polygon =>
            polygon.forEach(coords => {
                checkCoords(coords, feature.properties.sourceUrl);    
                console.log(coords);
            }));
    } else if (feature.type.toLowerCase() ==='multipoint') {

        feature.geometry.coordinates.forEach(coords => {
            checkCoords(coords, feature.properties.sourceUrl);    
            console.log(coords);
        });
    } else {
        checkCoords(feature.geometry.coordinates, feature.properties.sourceUrl);
    }
});
*/
    
geo.features.forEach(feature => {

    if (feature.geometry.type.toLowerCase() ==='polygon') {
        //console.log(JSON.stringify(feature.geometry.coordinates).blue);
        feature.geometry.coordinates.forEach(polys =>
            polys.forEach(coords => {
                checkCoords(coords, feature.properties.sourceUrl);    
                //console.log(coords);
            }));
    } else {
        checkCoords(feature.geometry.coordinates, feature.properties.sourceUrl);
    }

    //console.log(feature.type);
    //checkCoords(feature.geometry.coordinates, feature.properties.sourceUrl);
});

    