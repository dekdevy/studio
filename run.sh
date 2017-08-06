#!/bin/sh

apt-get install -yq python

rm -rf node_modules
npm install

node --harmony main.js
