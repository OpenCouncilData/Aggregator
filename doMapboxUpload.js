var upload=require('./upload-mapbox');
var options = require('command-line-args')([
    { name: 'topics', type: String, multiple: true, defaultOption: true }
]);
if (!options.topics) {
    console.log('Usage: doMapboxUpload topic1 [topic2...]');
} else {
    options.topics.forEach(upload.uploadTopic);
    
}

