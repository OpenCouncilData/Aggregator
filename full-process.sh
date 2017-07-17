export topic=$1;
node findDatasets.js --topics $topic --cloudant
./make-mbtiles.sh $topic