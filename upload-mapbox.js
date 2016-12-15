/* jshint esnext:true */
/* TODO
- move ID to feature.id, not feature.properties.id to support Mapbox dataset API.
*/

var config = require('./config.json').mapbox;

var upload = require('mapbox-upload');
var exists = require('file-exists');

exports.uploadFile = (filepath, topickey) => new Promise((resolve, reject) => {
    console.log(`Uploading ${filepath} for ${topickey}`);
    var progress = upload({
        file: filepath, 
        account: config.account,
        accesstoken: config.accesstoken,
        mapid: `opencouncildata.${topickey}`,
        name: topickey
    });

    progress.on('error', e => { console.log(e); reject(e); });
    progress.once('finished', x => { resolve(x); });
    progress.on('progress', p => process.stdout.write(`Uploaded: ${Math.round(p.percentage)}%\r`));
});

//require('./upload-mapbox').uploadTopic('dog-walking-zones');
// TODO check for an mbtiles file in out-mbtiles/[topic].mbtiles and upload that instead

exports.uploadTopic = (topickey) => {
    var filename = `out-mbtiles/${topickey}.mbtiles`;
    if (!exists(filename)) {
        filename = `out-geojsons/${topickey}.geojson`;
        if (!exists(filename)) {
            console.error('No topic file found in out-mbtiles or out-geojsons');
            return;
        }
    }

    return exports.uploadFile (filename, topickey)
        .then(() => console.log(`Uploaded ${topickey}`))
        .catch(e => console.error(e));
};