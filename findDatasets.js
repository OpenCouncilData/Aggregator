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
-- how do we set the right kind of icons for the layer? Do we need to?

- Add info about councils to browser, 
-- so we can show council names, no portal URLs as ids.
-- click on council name to jump to area


- Alter pipeline to work in a "check for updates" mode. Poll each site to see if new/updated datasets?
- Somehow deal with datasets like http://data.gov.au/geoserver/hsc-dog-walking-zones/wfs?request=GetFeature&typeName=ckan_f15a3a72_1367_4f2b_8428_416bcfc026a3&outputFormat=json 
  which are actually empty.

- Use TippeCanoe to generate tilesets before uploading.
  rm out-mbtiles/*; tippecanoe/tippecanoe --maximum-zoom 15 --simplify-only-low-zooms -o out-mbtiles/parking-zones.mbtiles --name parking-zones --layer parking-zones out-geojsons/parking-zones.geojson

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
        console.log('BLACKLIST '.red + uri);
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
function uploadFeatures(features, sourceUrl) {
    return;
    if (features === undefined) // some broken GeoJson files?
        return;

    return Promise.map(features, (feature, index) => {
        var id = sourceUrl + '#' + index;  // TODO fix this. We're filtering out bad layers, so this messes with counting?
        return uploadCloudant.upsert(feature, id)
        .then(() => console.log('Uploaded ' + id))
        .catch(e => {
            if (e.reason === 'Document update conflict.')
                1;//return; // We will need to handle updating datasets later on.
            console.error(`** ${e} (${id})`);
        });
    });
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
        console.warn(("Couldn't reproject geojson "  + e).red);
        return geojson;
    }
}

function checkCoords(coords, source, levels) {
    if (levels > 0) {
        return coords.reduce((ok, coord) => ok && checkCoords(coord, source, levels - 1), true);
    }

    //console.log(coords);
    try {
        //if (coords[0] >= 180 || coords[0] <= -180 || coords[1] >= 90 || coords[1] <= -90) {
        if (coords[0] >= 160 || coords[0] <= 90 || coords[1] >= -5 || coords[1] <= -50) {
            console.log('Bad geometry '.red + source + ' ' + coords.join(',').grey);
            return false;
            //console.log(feature.geometry);
        }
    } catch(e) {
        console.error('Really bad geometry '.red + source);
        return false;
        //console.log(feature.
    }
    return true;
}

function geometryOk(feature, source) {
    var ok = true;
    if (feature.geometry.type.toLowerCase() ==='multipolygon') {
        return checkCoords(feature.geometry.coordinates, source, 3);
    } else if (feature.geometry.type.toLowerCase() ==='polygon') {
        return checkCoords(feature.geometry.coordinates, source, 2);
    } else if (feature.geometry.type.toLowerCase() ==='multipoint') {
        return checkCoords(feature.geometry.coordinates, source, 1);
    } else {
        return checkCoords(feature.geometry.coordinates, source, 0 );
    }
}

// Process a GeoJson file, adding properties, then return features.
function extractFeatures(geojson, orgId, topickey, sourceUrl) {
    if (geojson === undefined || geojson.features === undefined)
        return [];
    console.log('Extracting ' + topickey.green + ' for ' + orgId.blue + ' ' + sourceUrl.cyan + ' ( ' + geojson.features.length + ' features)');
    var features = reprojectGeoJson(geojson, sourceUrl).features
        .filter(feature => geometryOk(feature, sourceUrl));
    features.forEach((feature, index) => {
        if (feature.properties === undefined) {
            feature.properties = {};
        }
        feature.properties.sourceCouncilId = orgId;
        feature.properties.openCouncilDataTopic = topickey;
        feature.properties.sourceUrl = sourceUrl;
    });
    return features;
}

function processGeoJson(geojson, orgId, topickey, url) {
    var features = extractFeatures(geojson, orgId, topickey, url);
    //console.log('Extracted ' + colors.green(features.length) + ' features from ' + colors.blue(resource.url) + ` for ${orgId}, ` + colors.red(topickey));
    featuresByTopic[topickey].features.push(...features);
    //console.log(featuresByTopic[topickey].features.length);
    return uploadFeatures(features, url);
}

// Return list of GeoJSON resources within a set of CKAN datasets.
function findGeoJsonResources(datasets, orgId, topickey) {
    var resources = [];
    //console.log(datasets);
    datasets.forEach(d => {
        if (d.resources) { 
            //console.log(d.resources);
            // for simplicity we just want the first geojson. Sometimes there are more than one, usually because something has gone wrong.
            // sometimes the format is set as 'json'. blergh.
            resources.push(d.resources.filter(r => {
                //console.log (`??? ${r.url}`);
                return !resourceBlacklist(r.url) && (r.format.match(/geojson/i) || r.url.match(/geojson/i) || r.format.match(/json/i) && r.url.match(/geoserver/));
            })[0]);
        }
    });
    resources = resources.filter(r => r !== undefined);
    //console.log(resources);
    return Promise.map(resources, resource => 
        getJson(resource.url)
        .then(gj => processGeoJson(gj, orgId, topickey, resource.url))
    );

}

function titleMatchesTopic(title, topic) {
    //console.log(title);
    return !(topic.titleBlacklist && title.match(topic.titleBlacklist)) && 
           !(topic.titleWhitelist && !title.match(topic.titleWhitelist));
}

/* Grrr. We can't use this dataset: https://data.melbourne.vic.gov.au/Assets-Infrastructure/Public-Toilets/ru3z-44we
But this geojson view of it exists: https://data.melbourne.vic.gov.au/resource/dsec-5y6t.geojson
But I can't find any link that takes us from A to  B.

Maybe use this horrible format: https://data.melbourne.vic.gov.au/api/views/ru3z-44we/rows.json
and convert to GeoJSON.


*/

function findSocrataDatasets(api, orgId, topickey) {
    return getJson(api + '/api/views.json')
        .then(results => { 
            //console.log(results[1]);
            return Promise.map(
                results.filter(item => item.metadata.geo && item.childViews && item.newBackend && titleMatchesTopic(item.name, topics[topickey])),
                item => {
                    var url = api + '/resource/' + item.childViews[0] + '.geojson' + '?$limit=50000';
                    //console.debug(orgId, topickey, url);
                    return getJson(url).then(gj => processGeoJson(gj, orgId, topickey, url));
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

// Return list of all datasets for an organisation that match a specific topic.
function findCkanDatasets(api, orgId, topic) {
    var org = orgId.match('organization') ? orgId.replace(/.*organization\//, '') : '';
    var uri = new URI(api + 'action/package_search').query({
            q: topic.searchTerm,
            fq: org ? `organization:${org}` : undefined,
            rows: 1000
        }).toString();
    //console.log(uri);
    return getJson(uri).then(result => {
        if (!result)
            return [];
        return result.result.results.filter(dataset => {
            //console.log(dataset.url);
            if (!orgId.match(dataset.organization.name))
                return false; // annoying test to filter out federated results
            return titleMatchesTopic(dataset.title, topic);
        });
    });

}

function writeCombinedGeoJsons() {
    const fs = require('fs');
    Object.keys(featuresByTopic).forEach(topickey => {
        if (featuresByTopic[topickey].features.length > 0) {
            console.log('Writing ' + topickey);
            fs.writeFile(`out-geojsons/${topickey}.geojson`, JSON.stringify(featuresByTopic[topickey]));
        }
    });
}

function processTopics(topickeys) {
    return getJson('https://opencouncildata.cloudant.com/councils/_design/platforms/_view/all?reduce=false')
        .then(result => Promise.map(result.rows, (row) => {
        //console.log(row.id);
        var portal = row.key;

        //if (row.id !== 'https://data.gov.au/organization/horsham-rural-city-council') 
        //   return;

        //if (!row.id.match(/melbourne/i))  return; 


        //if (!row.id.match(/data\.gov\.au/)) 
        //    return; 
        //    
        
        
        //topickeys = ['wards'];
        
        return Promise.map(topickeys, topickey => {
            if (topics[topickey] === undefined) {
                console.error('Unknown topic: ' + topickey);
                return;
            }
            if (portal.type === 'ckan') {
                return findCkanDatasets(portal.api, row.id, topics[topickey])
                    .then(datasets => findGeoJsonResources(datasets, row.id, topickey));
            } else if (portal.type === 'socrata' && !portal.api.match( /act\.gov\.au/)) {
                return findSocrataDatasets(portal.api, row.id, topickey);
            }
        });
    })).then(writeCombinedGeoJsons);
}

var options = require('command-line-args')([
    { name: 'topics', type: String, multiple: true, defaultOption: true }
]);

if (!options.topics) {
    // options.topics = Object.keys(topics);
    options.topics = ['wards'];
}

processTopics(options.topics);


//https://data.gov.au/api/3/action/package_search?fq=tags:(dogs)