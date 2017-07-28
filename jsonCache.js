var requestp = require('request-promise');
var URI = require('urijs');
var Promise = require('bluebird');
var fsp = Promise.promisifyAll(require('fs'));
var colors = require('colors');
/* jshint esnext:true */

var cacheFileName = 'cache.json';
var cacheDir = 'cache/';

var cache;

function getCache() {
    if (cache)
        return Promise.resolve(cache);
    return fsp.readFileAsync(cacheFileName)
    .then(data => {
        return JSON.parse(data);
    }).catch(e => ({ files: {}, next: 0 }))     // handle non-existent case
    .then(j => { cache = j; return cache; });
}

function cacheJson(json, source) {
    //console.log('Writing: ' + source);
    return getCache().then(cache => {
        var next = cache.next++;
        cache.files[source] = next;
        // we write sync to avoid concurrency issues with the next thing.
        fsp.writeFileSync(`${cacheDir}${next}.json`, JSON.stringify(json));
        //console.log('[Write cache ' + source + ']');
        return Promise.all([
            //fsp.writeFileAsync(`${cacheDir}${next}.json`, JSON.stringify(json)),
            fsp.writeFileAsync(cacheFileName, JSON.stringify(cache, undefined, 2))
        ]);
    });
}

function getActualJson(uri) {
    //console.log('===> ' + uri);
    return requestp({ uri: uri, json: true })
    .catch(error => console.error("** Couldn't fetch ".red + uri.red))/*console.error(error))*/;
}


exports.getJsonViaCache = function(source, skipCache) {
    if (skipCache || source.match(/package_search/))
        return getActualJson(source)
            .then(j => cacheJson(j, source).return(j));
    else return getCache()
        .then(cache => fsp.readFileAsync(`${cacheDir}${cache.files[source]}.json`))
        .then(contents => { 
            //console.log(`Cache hit ${cache.files[source]} = ${source}` ); 
            return JSON.parse(contents); } )
        .catch(e => { 
            //console.log('[Cache miss ' + source + ']'); 
            //console.error(e);
            return getActualJson(source)
                .then(j => cacheJson(j, source).return(j));
        });
};

