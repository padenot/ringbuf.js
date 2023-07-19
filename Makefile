all: doc build

doc: js/audioqueue.js js/index.js js/param.js js/param.js
	node node_modules/jsdoc/jsdoc.js js -d public/doc -R README.md

build:
	npm run-script build

check: build
	node tests/test.mjs

lint:
	npm run-script lint
