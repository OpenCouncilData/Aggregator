/* These are just backups of the design docs stored in Cloudant */

function (doc) {
  if (doc.properties && doc.properties.openCouncilDataTopic) {
    emit(doc.properties.openCouncilDataTopic, doc.properties.sourceCouncilId);  
  } 
}


function (keys, values, rereduce) {
    function zero(x) { return x ? x : 0 }

    var ret;
    if (rereduce) {
        ret = values[0];
        for (var i = 1; i < values.length; i++) {
            Object.keys(values[i]).forEach(function(topic) {
                if (!ret[topic])
                    ret[topic] = {};
                Object.keys(values[i][topic]).forEach(function(id) {
                    ret[topic][id] = zero(ret[topic][id]) + values[i][topic][id];
                });
            });
        }
    } else {
        ret = {};
        var i;
        for (i = 0; i < keys.length; i++) {
            var topic = keys[i][0], id = values[i];
            if (ret[topic] === undefined)
                ret[topic] = { };
            ret[topic][id] = zero(ret[topic][id]) + 1;
        }
    }
    return ret;
}





function (doc) {
  if (doc.properties && doc.properties.openCouncilDataTopic) {
    var ret = {};
    ret [doc.properties.openCouncilDataTopic] = {};
    ret [doc.properties.openCouncilDataTopic][doc.properties.sourceCouncilId] = 1;

    emit(null, ret);  
  } 
}



function (keys, values, rereduce) {
    function zero(x) { return x ? x : 0 }
    function add(i, topic, id) {
        ret[topic][id] = zero(ret[topic][id]) + values[i][topic][id];
    }
    var ret = values[0], i;
    for (i = 1; i < values.length; i++) {
        Object.keys(values[i]).forEach(function(topic) {
            if (!ret[topic])
                ret[topic] = {};
            Object.keys(values[i][topic]).forEach(add.bind(undefined, i, topic));
        });
    }
    return ret;
}