## Overview

This tool finds open datasets published by Australian councils in a number of pre-defined "topics", downloads them, combines them and uploads them to a CloudAnt database. It also generates Mapbox vector tiles so that geospatial data can be previewed through the Aggregator Front End.

All web requests are by default cached into the `cache/` directory and indexed in `cache.json`.

### Usage

```
node findDatasets.js --topics dog-walking-zones --cloudant
```

This does the following:

1. Search known data portals for datasets that match the criteria for the topic "dog-walking-zones"
2. Download geospatial files for each dataset.
3. Reproject each file to EPSG:4326
4. Check that the resulting geometry is sensible (points are really points, all locations are roughly within Australia, etc).
5. Add attributes to each feature, such as its source URL.
6. Write the combined GeoJSON file (eg, a single file with a feature for each garbage collection zone)
7. Upsert each feature to CloudAnt. 


```
./make-mbtiles.sh dog-walking-zones
```

This does:

1. Take the generated combined GeoJSON file and use TippeCanoe to generate an MBTiles file.
2. Uploads it to Mapbox.

### Topics

Topics are defined in `topics.js` like this:

```
// The key defines how the data will be accessed through the CloudAnt API, and is also used by the Aggregator front end.
'garbage-collection-zones': {
        // How relevant datasets will be found, by supplying this search term to CKAN/Socrata. A simple string is fine, or for more
        // complex needs, using CKAN's undocumented query language:
        searchTerm: '+title:"garbage collection" OR +title:"waste collection"',

        // If the title of a found dataset matches this regex, it will be rejected. Here, we want garbage collection zones, not truck routes, bin locations etc.
        titleBlacklist: /bins|stats|trucks|routes/i,

        // If the title of a found dataset *doesn't* match this regex, it will be rejected.
        titleWhitelist: /waste|garbage|recycling|rubbish/i
    },
``` 


## Components

- Fetcher: fetch likely datasets and upload them.
- 