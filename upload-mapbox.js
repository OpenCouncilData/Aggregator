/* jshint esnext:true */
/* TODO
- move ID to feature.id, not feature.properties.id to support Mapbox dataset API.
*/

var config = require('./config.json').mapbox;

var upload = require('mapbox-upload');

exports.uploadGeojson = (filepath, topickey) => new Promise((resolve, reject) => {
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
    progress.on('progress', p => console.log(`${p.percentage}%`));
});

//require('./upload-mapbox').uploadTopic('dog-walking-zones');
exports.uploadTopic = (topickey) => exports.uploadGeojson (`out-geojsons/${topickey}.geojson`, topickey)
    .then(() => console.log(`Uploaded ${topickey}`))
    .catch(e => console.error(e));