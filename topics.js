module.exports = {
    'dog-walking-zones': {
        searchTerm: 'dog walking zones',
        titleWhitelist: /dog/i,
        titleBlacklist: /bag/i
    },
    'garbage-collection-zones': {
        // note: this is the correct syntax for searching two alternative phrases. Everything else is wrong.
        searchTerm: '+title:"garbage collection" OR +title:"waste collection"',
        titleBlacklist: /bins|stats|trucks|routes|points/i,
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
        titleWhitelist: /drain/i,
        titleBlacklist: /basin|pit|catchment/i
    },
    'parks': {
        searchTerm: '+title:parks OR +title:"open space"',
        titleWhitelist: /park|open space/i,
        titleBlacklist: /parking|carpark|trees|shelters|playground|dog|caravan|track/i
    },
    'trees': {
        searchTerm: 'trees',
        titleWhitelist: /trees/i,
        titleBlacklist: /species|flora|catalogue|pit/i
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
        searchTerm: '+title:venues OR +title:halls',
        titleWhitelist:/venue|hall/i
    },
    'wards': {
        searchTerm: 'wards',
        titleWhitelist: /wards/i,
        titleBlacklist: /register|bridges|councillors/i
    },
    'road-closures': {
        searchTerm: 'road closures',
        titleWhitelist: /road closure/i
    }
};
