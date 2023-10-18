# feathers-import-export

[![Latest Release](https://img.shields.io/github/v/tag/kalisio/feathers-import-export?sort=semver&label=latest)](https://github.com/kalisio/feathers-import-export/releases)
[![Build Status](https://app.travis-ci.com/kalisio/feathers-import-export.svg?branch=master)](https://app.travis-ci.com/kalisio/feathers-import-export)
[![Code Climate](https://codeclimate.com/github/kalisio/feathers-import-export/badges/gpa.svg)](https://codeclimate.com/github/kalisio/feathers-import-export)
[![Test Coverage](https://codeclimate.com/github/kalisio/feathers-import-export/badges/coverage.svg)](https://codeclimate.com/github/kalisio/feathers-import-export/coverage)
[![Download Status](https://img.shields.io/npm/dm/@kalisio/feathers-import-export.svg?style=flat-square)](https://www.npmjs.com/package/@kalisio/feathers-import-export)

> `feathers-import-export` provides convenient methods to import/export to/from FeathersJS services.

## Principle

_TODO_

## Usage

### Installation

```shell
npm install @kalisio/feathers-import-export --save
```

or

```shell
yarn add @kalisio/feathers-import-export
```

### Example

## API

`feathers-import-export` consists in a single service that provides the following methods:

### Service (app, options)

### create (data, params)

Shortcut method that calls [import](#import) or [export](#export) according the value of the `method` property.

The payload `data` must contain the following properties:

| Property | Description |
|---|---|
| `method` | the method to call, either `ìmport` or `export`. This property is mandatory. |

Concerning other properties, refer to the description of the different methods.

### import (data, params)

### export (data, params)

Exports the result of a query into a **JSON**, **CSV** or **GeoJson** file that can downloaded using a **Presigned URL**.

The file can be compressed using [GZip](https://www.gzip.org/).

The payload `data` must contain the following properties:

| Property | Description |
|---|---|
| `service` | the service to be queried. This property is mandatory. |
| `query` | the query to apply. Default value is `{}` |
| `format` | the output format. Defaut value is `json` |
| `zip`| whether to zip the output or not. Default value is `true` |
| `chunkSize` | the number of objects to be processed by chunk. Defaut value is `1000` |
| `expiresIn` | the expiration delay of the returned signed url. Default value is `300` |

## License

Copyright (c) 2017-20xx Kalisio

Licensed under the [MIT license](LICENSE).

## Authors

This project is sponsored by 

[![Kalisio](https://s3.eu-central-1.amazonaws.com/kalisioscope/kalisio/kalisio-logo-black-256x84.png)](https://kalisio.com)
