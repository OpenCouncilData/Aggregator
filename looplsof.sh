#!/bin/bash
# For checking why so many file handles were being opened.
# In another tab, run: 
# ./findDatasets ... & echo $! > pid; fg
while true
do
  lsof -p `cat pid` | wc -l
  sleep 2
done