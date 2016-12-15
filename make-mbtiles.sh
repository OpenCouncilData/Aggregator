#!/bin/bash
export topic=$1
rm out-mbtiles/${topic}.mbtiles
tippecanoe/tippecanoe --maximum-zoom 15 --simplify-only-low-zooms -o out-mbtiles/${topic}.mbtiles --name ${topic} --layer ${topic} out-geojsons/${topic}.geojson
