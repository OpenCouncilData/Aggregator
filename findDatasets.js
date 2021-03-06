#!/usr/bin/env node --max-old-space-size=8192
/*

Out of memory? node --max-old-space-size=8192 findDatasets.js 


 */

//'use strict';
var requestp = require('request-promise');
var URI = require('urijs');
var Promise = require('bluebird');
var uploadCloudant = require('./upload-cloudantp');
var epsg = require('epsg');
var reproject = require('reproject');
var colors = require('colors');
var fs = require('fs');
/* jshint esnext:true */

/* 
TODO
- find out why tree generation failed
- measure quality of datasets, provide rating out of 100
- adjust maps to turn quality rating into color.
- color code attributes based on "required", "optional", "non-standard"
✓ generate map styles in the browser, so Mapbox becomes a dumb host of tiles only (plus a basemap).
 ✓ style a basemap, then do Map.addLayer() with "data-polygons", "data-points", "data-lines" layer etc
-- hence, add visualisation options like "recently updated", "number of attributes"
 ✓ how do we set the right kind of icons for the layer? Do we need to? ["icon" property in the front end]
- Upload features in bulk to save money.

- Add info about councils to browser, 
-- so we can show council names, no portal URLs as ids.
-- click on council name to jump to area

- Add API endpoints to each topic in the front end
  Geo query:
  https://opencouncildata.cloudant.com/test1/_design/geo/_geo/dog-geo?lat=-38.17046&lon=144.35649&radius=0&include_docs=true

  Other query:
  https://opencouncildata.cloudant.com/test1/_design/features/_search/topics?q=topic:garbage-collection-zones&include_docs=true

- Use better IDs for councils instead of their data portal URLs

- Add a query


- Alter pipeline to work in a "check for updates" mode. Poll each site to see if new/updated datasets?
- Somehow deal with datasets like http://data.gov.au/geoserver/hsc-dog-walking-zones/wfs?request=GetFeature&typeName=ckan_f15a3a72_1367_4f2b_8428_416bcfc026a3&outputFormat=json 
  which are actually empty.

✓ Use TippeCanoe to generate tilesets before uploading.
  rm out-mbtiles/*; tippecanoe/tippecanoe --maximum-zoom 15 --simplify-only-low-zooms -o out-mbtiles/parking-zones.mbtiles --name parking-zones --layer parking-zones out-geojsons/parking-zones.geojson

- Do these warnings matter when generating mbtiles: 
  Warning: Can't represent non-numeric feature ID "ckan_e77b6c07_39f2_454d_ae72_4976cab1dfb3.3"

*/

var topics = require('./topics');

var _resourceBlacklist = [
'http://data.gov.au/dataset/42ddadff-d5c9-406c-9dc4-e5830a6dc837/resource/456ff78c-31f2-4ed9-9c06-e91c1d9bc915/download/gpspublictoilets.json',
'http://data.gov.au/dataset/1b12dff9-b90a-4009-b507-7092d9d5f695/resource/3afa2b13-d905-49c2-8edd-1208e4d45875/download/gpshalls.json', 
'http://data.gov.au/dataset/06548285-28fd-4300-8121-996604d58dfd/resource/2fd627f0-a2a2-4664-9273-85e882288182/download/gpsplaygrounds.json',
'http://data.gov.au/dataset/cdbff5d2-8a9c-4922-afd5-00be9379f76a/resource/840e49c5-7ed2-4a40-88b5-6faf3ee65f3a/download/gpsskateparks.json',
'http://data.gov.au/dataset/758f8ffc-34e2-47b8-ac0a-e143412ddad4/resource/0070e881-13b2-4acb-8d97-f1a10d27af87/download/gpsovals.json',
'http://data.gov.au/dataset/12bca8b6-95f0-4d17-bfbb-b7fd9f5637f7/resource/11b2042d-d93d-4702-8ee8-99d13fc4818e/download/gpsbikeparks.json'];
function resourceBlacklist(uri) {
    if (_resourceBlacklist.indexOf(uri) !== -1) {
        log.medium('BLACKLIST '.red + uri);
        return true;
    }
    return false;
}

    


// collection of all the geojson files for each topic.
var featuresByTopic = {};

Object.keys(topics).forEach(topickey => featuresByTopic[topickey] = {
    type: 'FeatureCollection',
    features: []
    });


const getJson = require('./jsonCache').getJsonViaCache;

// Split a GeoJson file into features and upload them separately to CloudAnt, with ID like "http://data.gov.au/...geojson#4"
function uploadFeatures(features, orgId) {
    //return;
    if (features === undefined) // some broken GeoJson files?
        return;
    var uploadCount = 0;
    return Promise.map(features, (feature, index) => {
        var id = feature.properties.sourceUrl + '#' + index;  // TODO fix this. We're filtering out bad layers, so this messes with counting?
        return uploadCloudant.upsert(feature, id)
        .then(() => uploadCount++)

        .then(() => log.low('Uploaded ' + id))
        .catch(e => {
            if (e.reason === 'Document update conflict.')
                1;//return; // We will need to handle updating datasets later on.
            console.error(`** ${e} (${id})`);
        });
        
    }, { concurrency: 500 } // Limit the number of features uploaded at once to Cloudant. Otherwise it consumes thousands of file descriptors and your system crashes.
    ).finally(() => log.high(`${uploadCount} features uploaded for ${orgId}.`));
}

// Not all GeoJSON files are in the recommended WGS84/latlon/EPSG:4326 projection.

// TODO: Some files (eg west wimmera garbage collection zones) *are* in 4326, but wrongly have a CRS defined.
function reprojectGeoJson(geojson, sourceUrl) {
    if (geojson.crs === undefined) {
        // no CRS, hopefully it's in EPSG 4326.
        return geojson;
    }

    if (sourceUrl === 'http://data.gov.au/geoserver/ysc-garbage-collection-zones/wfs?request=GetFeature&typeName=ckan_e7b72b97_8046_4d84_ab9f_874a549f907d&outputFormat=json' ||
        sourceUrl === 'http://data.gov.au/geoserver/wwsc-garbage-collection-zones/wfs?request=GetFeature&typeName=ckan_e77b6c07_39f2_454d_ae72_4976cab1dfb3&outputFormat=json' ||
        sourceUrl === 'http://data.gov.au/geoserver/hrcc-garbage-collection/wfs?request=GetFeature&typeName=ckan_55364505_b0f4_4006_8544_95c9ed8d11ad&outputFormat=json' ||
        sourceUrl === 'http://data.gov.au/geoserver/hsc-garbage-collection-zones/wfs?request=GetFeature&typeName=ckan_4a51f8a2_90a9_4b52_8ef2_d7cecff14803&outputFormat=json' ||
        sourceUrl === 'http://data.gov.au/geoserver/ballarat-parking-machines/wfs?request=GetFeature&typeName=919da8f8_0aa6_4f90_9d21_45331e4bea7c&outputFormat=json'
        ) return geojson;
    try {

        return reproject.toWgs84(geojson, undefined, epsg);  /* undefined = autodetect */
    } catch (e) {
        log.warn("Couldn't reproject geojson "  + e);
        return geojson;
    }
}

function checkCoords(coords, source, levels) {
    if (levels > 0) {
        return coords.reduce((ok, coord) => ok && checkCoords(coord, source, levels - 1), true);
    }
    try {
        if (coords[0] >= 160 || coords[0] <= 90 || coords[1] >= -5 || coords[1] <= -50) {
            log.warn('Bad geometry '.red + source + ' ' + coords.join(',').grey);
            return false;
        }
    } catch(e) {
        // Ie, coords isn't even an array of 4 elements.
        log.warn('Really bad geometry '.red + source);
        return false;
    }
    return true;
}

function geometryOk(feature, source) {
    if (!feature || !feature.geometry || !feature.geometry.type || !feature.geometry.coordinates) {
        return false
    }
    var ok = true, 
        gtype = feature.geometry.type.toLowerCase(), 
        coords = feature.geometry.coordinates;
    if (gtype ==='multipolygon') {
        return checkCoords(coords, source, 3);
    } else if (gtype ==='polygon') {
        return checkCoords(coords, source, 2);
    } else if (gtype ==='multipoint') {
        return checkCoords(coords, source, 1);
    } else {
        return checkCoords(coords, source, 0 );
    }
}

// Process a GeoJson file, adding properties, then return features.
function extractFeatures(geojson, orgId, topickey, sourceUrl, datasetTitle) {
    if (geojson === undefined || geojson.features === undefined)
        return [];
    log.medium('Extracting ' + (datasetTitle ? ` ${datasetTitle.blue} ` : '') + `"${topickey.yellow}"` + ' for ' + orgId.replace(/.*\//,'').blue + ' ' + sourceUrl.cyan + ' ( ' + geojson.features.length + ' features)');
    var features = reprojectGeoJson(geojson, sourceUrl).features
        .filter(feature => geometryOk(feature, sourceUrl));
    features.forEach((feature, index) => {
        if (feature.properties === undefined) {
            feature.properties = {};
        } else {
            // force property keys to lower case.
            Object.keys(feature.properties).forEach(prop => {
                if (prop !== prop.toLowerCase()) {
                    feature.properties[prop.toLowerCase()] = feature.properties[prop];
                    delete feature.properties[prop];
                }
            });
        }

        feature.properties.sourceCouncilId = orgId;
        feature.properties.openCouncilDataTopic = topickey;
        feature.properties.sourceUrl = sourceUrl;
    });
    return features;
}


var writeStreams = {}; 

function storeFeatures(topickey, features) {
    // old
    featuresByTopic[topickey].features = featuresByTopic[topickey].features.concat(features);

    features.forEach(feature => {
        if (writeStreams[topickey].__doneFirst) {
            writeStreams[topickey].write(options.trueGeoJson ? ',\n' : '\n');
        } else {
            writeStreams[topickey].__doneFirst = true;
        }
        writeStreams[topickey].write(JSON.stringify(feature)); //???

    });

}

function processGeoJson(geojson, orgId, topickey, url, datasetTitle) {

    var features = extractFeatures(geojson, orgId, topickey, url, datasetTitle);
    features.forEach((feature, i) => feature.id = i); // I have no idea what the implications of this are. Just trying to avoid the Tippecanoe warning.

    log.low('Extracted ' + colors.green(features.length) + ' features from ' + colors.blue(url) + ` for ${orgId}, ` + colors.red(topickey));
    //featuresByTopic[topickey].features.push(...features); // doesn't work if very many features
    storeFeatures(topickey, features);
        //feature.id = String(feature.id).replace(/[^0-9]/g, ''));
    //console.log(featuresByTopic[topickey].features.length);
    return features;
    //return uploadFeatures(features, url);
}

// Return list of GeoJSON resources within a set of CKAN datasets.
function findGeoJsonResources(datasets, orgId, topickey) {
    var resources = [];
    //console.log(datasets);
    datasets.forEach(d => {
        if (d.resources) {
            
            //console.log(d.resources);
            var gjResources = d.resources.filter(r => {
                //console.log (`??? ${r.url}`);
                return !resourceBlacklist(r.url) && 
                    (r.format.match(/geojson/i) || 
                     r.url.match(/geojson/i) || 
                     r.format.match(/json/i) && r.url.match(/geoserver/));
            });
            if (gjResources.length >= 1) {
                gjResources[0].datasetTitle = d.title;                
                resources.push(gjResources[0]); // If there is more than one matching resource, usually something has gone wrong. Let's ignore that fact.
            }
        }
    });
    // remove datasets with no matching resources
    //resources = resources.filter(r => r !== undefined);
    //console.log(resources);
    return Promise.map(resources, resource => 
        getJson(resource.url)
        .then(gj => processGeoJson(gj, orgId, topickey, resource.url, resource.datasetTitle))
        .then(features => options.cloudant ? uploadFeatures(features, orgId) : undefined)
    );

}

function titleMatchesTopic(title, topic) {
    //console.log(title);
    return !(topic.titleBlacklist && title.match(topic.titleBlacklist) && !(void log.verylow(`${title} fails title blacklist ${topic.titleBlacklist}`))) && 
           !(topic.titleWhitelist && !title.match(topic.titleWhitelist) && !(void log.verylow(`${title} fails title whitelist ${topic.titleWhitelist}`)));
}


function findSocrataDatasets(api, orgId, topickey) {

    /* Grrr. We can't use this dataset: https://data.melbourne.vic.gov.au/Assets-Infrastructure/Public-Toilets/ru3z-44we
    But this geojson view of it exists: https://data.melbourne.vic.gov.au/resource/dsec-5y6t.geojson
    But I can't find any link that takes us from A to  B.

    Maybe use this horrible format: https://data.melbourne.vic.gov.au/api/views/ru3z-44we/rows.json
    and convert to GeoJSON.

    TODO unkludge this!
    */
    var geojsons = {
        'ru3z-44we': 'dsec-5y6t',
        '8fgn-5q6t':'w4fc-iq27'
    }

    return getJson(api + '/api/views.json')
        .then(results => { 
            //console.log(results[1]);
            return Promise.map(
                results.filter(item => (geojsons[item.id] || item.metadata.geo && item.childViews && item.newBackend) && titleMatchesTopic(item.name, topics[topickey])),
                item => {
                    var url = api + '/resource/' + (geojsons[item.id] || item.childViews[0]) + '.geojson' + '?$limit=50000';
                    //console.debug(orgId, topickey, url);
                    return getJson(url)
                        .then(gj => processGeoJson(gj, orgId, topickey, url)) // TODO Upload to Cloudant!
                        .then(features => options.cloudant ? uploadFeatures(features, orgId) : undefined);
                }
            );
        });
        

/*
- start with /api/views.json
- find things with newBackend: true and item.metadata.geo defined and item.childViews defined
- use the childview id to get a geojson url like http://data.melbourne.vic.gov.au/resource/5vf3-qixi.geojson
- consider adding props like $limit=10000&$order=:id, then paging through (with $limit=10000&$offset=10000&$order=:id)


 */


}

// Return list of all datasets for an organisation that match a specific topic, in native CKAN format.
function findCkanDatasets(api, orgId, topic) {
    var org = orgId.match('organization') ? orgId.replace(/.*organization\//, '') : '';
    var uri = new URI(api + 'action/package_search').query({
            q: topic.searchTerm,
            fq: org ? `organization:${org}` : undefined,
            rows: 1000
        }).toString();
    log.low(uri);

    return getJson(uri).then(result => {
        if (!result)
            return [];
        //log.low(JSON.stringify(result));
        return result.result.results.filter(dataset => {
            //console.log(dataset.url);
        
            
            if (!dataset.organization) {
                //log.low(`No organisation for ${dataset.title}, ${dataset.url}`);
                // Seems to be a problem with datasets that have no orgs getting federated to data.sa.gov.au and matching searches there
                return false;
            } else if (!orgId.match(dataset.organization.name))
                return false; // annoying test to filter out federated results
            return titleMatchesTopic(dataset.title, topic);
        });
    });

}

function writeCombinedGeoJsons() {
    const fs = require('fs');
    Object.keys(featuresByTopic).forEach(topickey => {
        if (featuresByTopic[topickey].features.length > 0) {
            log.high('Writing ' + topickey);
            fs.writeFile(`out-geojsons/${topickey}.geojson`, JSON.stringify(featuresByTopic[topickey]));
        }
    });
}

function createOutputGeoJson(topickey) {
    writeStreams[topickey] = fs.createWriteStream(`./out-geojsons/${topickey}.geojson`);
    var stream = writeStreams[topickey];


    stream.on('error', function (err) {
        console.log(err);
    });

    if (options.trueGeoJson) { // If not "true GeoJSON" we write this abbreviated form which is better for Tippecanoe
        stream.write('{"type": "FeatureCollection", "features": [\n');
    }
    return stream;
}

function closeOutputGeoJson(topickey) {
    if (writeStreams[topickey]) {
        if (options.trueGeoJson) {
            writeStreams[topickey].write('\n]}');
        }
        writeStreams[topickey].end();
    }
}

/*
  Download and process all possible datasets for each topic.
*/
function processTopics(topickeys) {
    // don't cache this list
    return getJson('https://opencouncildata.cloudant.com/councils/_design/platforms/_view/all?reduce=false', true)
        //.then(result => { log.low(result.rows.map(row => row.key.title).join(',')); return result; })
        .tap(result => log.low(result.rows.map(row => row.key.title).join(',')))
        .then(result => Promise.map(result.rows, (council) => {
            //console.log(council.id);

            var portal = council.key;


            if (options.council && !council.key.title.match(options.council)) {
                //log.low(`Skipping ${council.key.title}`);
                return;
            }
        
            return Promise.map(topickeys, topickey => {
                var stream = createOutputGeoJson(topickey);
                if (topics[topickey] === undefined) {
                    return void log.error('Unknown topic: ' + topickey);
                }
                if (portal.type === 'ckan') {
                    return findCkanDatasets(portal.api, council.id, topics[topickey])
                        .tap(datasets => log.low(`Got ${datasets.length} datasets.`))
                        .then(datasets => findGeoJsonResources(datasets, council.id, topickey));
                } else if (portal.type === 'socrata' && !portal.api.match( /act\.gov\.au/)) {
                    return findSocrataDatasets(portal.api, council.id, topickey);
                }
            });
    }//, {//concurrency: 1}
    )).then(() => topickeys.forEach(closeOutputGeoJson));

    //.then(writeCombinedGeoJsons);
}

var options = require('command-line-args')([
    { name: 'topics', type: String, multiple: true, defaultOption: true },
    { name: 'lowcache', type: Boolean },
    { name: 'loglevel', type: Number },
    { name: 'council', type: String},
    { name: 'cloudant', type: Boolean, defaultOption: false }
]);
var log = require('./log')(options.loglevel);

if (!options.topics) {
    // options.topics = Object.keys(topics);
    options.topics = ['wards'];
}

processTopics(options.topics);


//https://data.gov.au/api/3/action/package_search?fq=tags:(dogs)