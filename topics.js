module.exports = {
    'dog-walking-zones': {
        searchTerm: '+title:"dog walking" OR +title:"dog off"',
        titleWhitelist: /dog/i,
        titleBlacklist: /bag/i
    },
    'garbage-collection-zones': {
        // note: this is the correct syntax for searching two alternative phrases. Everything else is wrong.
        // TODO: Allow an array of strings, and just run several queries.
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
        searchTerm: '+title:"drains" OR +title:"drainpipes" OR +title:"stormwater" OR +title:"drainage"',
        titleWhitelist: /drain|stormwater|pipe/i,
        titleBlacklist: /basin|pit|catchment|overlay|node|connection|areas|future|planning|points/i
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
        searchTerm: '+title:"facilities" OR "libraries" OR +"community centres"',
        titleBlacklist: /parks|proposed/i,
        titleWhitelist: /facilities|librar|community centre/i
    },
    'childcare-centres': {
        searchTerm: '+title:"childcare" OR +title:"child care" OR +title:"kindergarten"',
        titleWhitelist: /child.?care|kindergarten/i
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
    },
    'property-boundaries': {
        searchTerm: 'property boundaries',
        titleWhitelist: /propert|cadastr/i
    },
    'street-furniture': {
        searchTerm: '+title:"furniture" OR +title:"bbq"',
        //titleBlacklist: /bins|stats|trucks|routes|points/i,
        titleWhitelist: /furniture|bbq/i
    }
};
