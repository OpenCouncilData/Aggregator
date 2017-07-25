export topic=$1;
node --max-old-space-size=8192 findDatasets.js --topics $topic --cloudant
./make-mbtiles.sh $topic

