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
*/


var topics = {
    'dog-walking-zones': {
        searchTerm: 'dog walking zones',
        titleWhitelist: /dog/i,
        titleBlacklist: /bag/i
    },
    'garbage-collection-zones': {
        searchTerm: 'garbage collection zones',
        titleBlacklist: /bins|stats|trucks|routes/i,
        titleWhitelist: /waste|garbage|recycling|rubbish/i
    },
    'public-toilets': {
        searchTerm: 'public-toilets',
        //titleBlacklist: /bins|stats|trucks|routes/i,
        titleWhitelist: /toilet|amenities/i
    },
    'parking-zones': {
        searchTerm: 'parking',
        titleBlacklist: /parks|infringement|machine|dog/i,
        titleWhitelist: /parking/i
    },
    'footpaths': {
        searchTerm: 'footpaths',
        titleBlacklist: /defect/i,
        titleWhitelist: /path/i
    },
    'customer-service-centres': {
        searchTerm: 'customer service centres',
        titleWhitelist: /customer service/i
        //titleBlacklist: /
    },
    'drainpipes': {
        searchTerm: 'drains',
        titleBlacklist: /basin|pit|catchment/g
    },
    'parks': {
        searchTerm: 'parks',
        titleBlacklist: /parking|carpark/
    },
    'trees': {
        searchTerm: 'trees',
        titleWhitelist: /trees/i,
        titleBlacklist: /species|flora|catalogue|pits/i
    },
    'facilities': {
        searchTerm: 'facilities',
        titleBlacklist: /parks/i,
        titleWhitelist: /facilities/i
    },
    'childcare-centres': {
        searchTerm: 'childcare centres',
        titleWhitelist: /child.?care/i
    },
    'venues-for-hire': {
        searchTerm: 'title:venues OR title:halls',
        titleWhitelist:/venue|hall/i
    }
};

var _resourceBlacklist = [
'http://data.gov.au/dataset/42ddadff-d5c9-406c-9dc4-e5830a6dc837/resource/456ff78c-31f2-4ed9-9c06-e91c1d9bc915/download/gpspublictoilets.json',
'http://data.gov.au/dataset/1b12dff9-b90a-4009-b507-7092d9d5f695/resource/3afa2b13-d905-49c2-8edd-1208e4d45875/download/gpshalls.json'];
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
    //return;
    if (features === undefined) // some broken GeoJson files?
        return;

    return Promise.map(features, (feature, index) => {
        var id = sourceUrl + '#' + index;
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
function reprojectGeoJson(geojson) {
    try {

        return reproject.toWgs84(geojson, undefined, epsg);  /* undefined = autodetect */
    } catch (e) {
        // can't reproject? Let's pray that it's in WGS84 already?
        return geojson;
    }
}

// Process a GeoJson file, adding properties, then return features.
function extractFeatures(geojson, orgId, topickey, sourceUrl) {
    if (geojson === undefined || geojson.features === undefined)
        return [];
    console.log('Extracting ' + topickey.red + ' for ' + orgId.blue + ' ' + sourceUrl.cyan);
    var features = reprojectGeoJson(geojson).features;
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
    console.log(featuresByTopic[topickey].features.length);
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
                console.log (`??? ${r.url}`);
                return !resourceBlacklist(r.url) && (r.format.match(/geojson/i) || r.format.match(/json/i) && r.url.match(/geoserver/));
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
                    var url = api + '/resource/' + item.childViews[0] + '.geojson' + '?$limit=10000';
                    console.log(orgId, topickey, url);
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
    console.log(uri);
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

var allPortals = getJson('https://opencouncildata.cloudant.com/councils/_design/platforms/_view/all?reduce=false')
    .then(result => Promise.map(result.rows, (row) => {
    //console.log(row.id);
    var portal = row.key;

    //if (row.id !== 'https://data.gov.au/organization/horsham-rural-city-council') 
    //   return;

    //if (!row.id.match(/hindmarsh/i)) 
    //    return; 


    //if (!row.id.match(/data\.gov\.au/)) 
    //    return; 
    //    
    
    var topickeys = Object.keys(topics);
    topickeys = ['venues-for-hire'];
    
    return Promise.map(topickeys, topickey => {
        if (portal.type === 'ckan') {
            return findCkanDatasets(portal.api, row.id, topics[topickey])
                .then(datasets => findGeoJsonResources(datasets, row.id, topickey));
        } else if (portal.type === 'socrata' && !portal.api.match( /act\.gov\.au/)) {
            return findSocrataDatasets(portal.api, row.id, topickey);
        }
    });
})).then(writeCombinedGeoJsons);


//https://data.gov.au/api/3/action/package_search?fq=tags:(dogs)