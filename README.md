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

### constructor (app, options)

Create an instance of the service with the given options:

| Parameter | Description | Required |
|---|---|---|
|`s3Service` | the s3Service to be retrieved from the `app`. | yes |
| `workingDir` | the working directory to process temporary files. Default value is `/tmp` | no |

### create (data, params)

Shortcut method that calls [import](#import) or [export](#export) according the value of the `method` property.

The payload `data` must contain the following properties:

| Argument | Description | Required |
|---|---|---|
| `method` | the method to call, either `ìmport` or `export`. | yes |

Concerning the other properties, refer to the description of the different methods.

### import (data, params)

Imports the content of a file that is stored on a **S3** compatible storage.

The payload `data` must contain the following properties:

| Argument | Description | Required |
|---|---|
| `id` | the object key. Note that the final computed **Key** takes into account the `prefix` option of the service. | yes |
| `servicePath` | the path to the service into which to import the data. | yes |

### export (data, params)

Exports the result of a query into a **JSON**, **CSV** or **GeoJson** file that it stored on an **S3** compatbile storage.

The file can be compressed using [GZip](https://www.gzip.org/).

The payload `data` must contain the following properties:

| Argument | Description | Required 
|---|---|---|
| `servicePath` | the path to the service to be queried.| yes |
| `query` | the query to apply. Default value is `{}` | no |
| `format` | the output format. Defaut value is `json` | no |
| `zip`| whether to zip the output or not. Default value is `true` | no |
| `chunkSize` | the number of objects to be processed by chunk. Defaut value is `500` | no |
| `expiresIn` | the expiration delay of the returned signed url. Default value is `300` | no |

It returns the `key` to the file.

## License

Copyright (c) 2017-20xx Kalisio

Licensed under the [MIT license](LICENSE).

## Authors

This project is sponsored by 

[![Kalisio](https://s3.eu-central-1.amazonaws.com/kalisioscope/kalisio/kalisio-logo-black-256x84.png)](https://kalisio.com)
