all: doc build

doc: js/audioqueue.js js/index.js js/param.js js/param.js
	node node_modules/jsdoc/jsdoc.js -t node_modules/jaguarjs-jsdoc js -d public/doc -R README.md

build:
	npm run-script build

check: build
	node tests/test.mjs
