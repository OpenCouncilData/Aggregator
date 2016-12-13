/*
    Upload the contents of a JSON file to Cloudant.
 */

var config = require('./config.json');
var cloudant = require('cloudant-promise')({ account: config.cloudant.account, password: config.cloudant.password });
var Promise = require('bluebird');
/* jshint esnext:true */

exports.upload = function(json, sourceurl) {


    var db = cloudant.use(config.cloudant.database);

    json._id = sourceurl; // is this a good idea?
  
    return db.insert(json);
        /*if (!err)
            console.log('Uploaded ' + sourceurl);
        else
            console.log('**' + err.reason);*/

};

// if we want to update an existing feature, we need to first fetch the old one, and set _rev to it

exports.upsert = function(json, sourceurl) {

    var db = cloudant.use(config.cloudant.database);

    // would prefer to use fetchRevs, new in v6?
    return Promise.resolve(db.head(sourceurl))
        .then(headers => {
            json._rev = headers[1].etag.replace(/"/g, ''); // really weird, the revids are wrapped in double quotes.
            console.log('Upserting: ' + sourceurl);
            console.log(json._rev);
        }).catch((e) => {
            // we just want to catch 404s (no existing document to replace), but we're ignoring all errors. TODO

            if (!json._rev) {
                //console.warn('No existing document');
            }

            
            json._id = sourceurl;

            return db.insert(json);
        });
};