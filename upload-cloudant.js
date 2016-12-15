/*
    Upload the contents of a JSON file to Cloudant.
 */

exports.upload = function(json, sourceurl) {

    var config = require('./config.json');
    var cloudant = require('cloudant')({ account: config.cloudant.account, password: config.cloudant.password });

    var db = cloudant.use(config.cloudant.database);

    json._id = sourceurl; // is this a good idea?
    // if we want to update an existing feature, we need to first fetch the old one, and set _rev to it
  
    db.insert(json, undefined, function(err, body) {
        if (!err)
            console.log('Uploaded ' + sourceurl);
        else
            console.log('**' + err.reason);
    });

};