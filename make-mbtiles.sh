#!/bin/bash
export topic=$1
rm out-mbtiles/${topic}.mbtiles
echo "Converting out-geojsons/${topic}.geojson => out-mbtiles/${topic}.mbtiles"
# Consider -Bg for guess zoom level
tippecanoe/tippecanoe --maximum-zoom 15 --detect-shared-borders --simplification 10 --drop-lines --drop-polygons -Bg --drop-densest-as-needed --simplify-only-low-zooms -o out-mbtiles/${topic}.mbtiles --name ${topic} --read-parallel --layer ${topic} out-geojsons/${topic}.geojson
# echo "Uploading out-mbtiles/${topic}.mbtiles to Mapbox"
./doMapboxUpload.js --topics ${topic}