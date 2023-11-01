import _ from 'lodash'
import sift from 'sift'
import moment from 'moment'
import { unit } from 'mathjs'

export function transform (json, options) {
  if (options.toArray) {
    json = _.toArray(json)
  }
  if (options.toObjects) {
    json = json.map(array => array.reduce((object, value, index) => {
      // Set the value at index on object using key provided in input list
      const propertyName = options.toObjects[index]
      object[propertyName] = value
      return object
    }, {}))
  }
  // Safety check
  const isArray = Array.isArray(json)
  if (!isArray) {
    json = [json]
  }
  if (options.filter) {
    json = sift(options.filter, json)
  }
  // By default we perform transformation in place
  if (!_.get(options, 'inPlace', true)) {
    json = _.cloneDeep(json)
  }
  // Iterate over path mapping
  _.forOwn(options.mapping, (output, inputPath) => {
    const isMappingObject = (typeof output === 'object')
    const outputPath = (isMappingObject ? output.path : output)
    const deleteInputPath = (isMappingObject ? _.get(output, 'delete', true) : true)
    // Then iterate over JSON objects
    _.forEach(json, object => {
      if (!_.has(object, inputPath)) return
      let value = _.get(object, inputPath)
      // Perform value mapping (if any)
      if (isMappingObject && output.values) {
        value = output.values[value]
      }
      // Perform key mapping
      _.set(object, outputPath, value)
    })
    if (deleteInputPath) {
      _.forEach(json, object => {
        _.unset(object, inputPath)
      })
    }
  })
  // Iterate over unit mapping
  _.forOwn(options.unitMapping, (units, path) => {
    // Then iterate over JSON objects
    _.forEach(json, object => {
      // Perform conversion
      if (_.has(object, path)) {
        let value = _.get(object, path)
        // Handle dates
        if (units.asDate) {
          let date
          // Handle UTC or local dates using input format if provided
          if (units.asDate === 'utc') {
            date = (units.from ? moment.utc(value, units.from) : moment.utc(value))
          } else {
            date = (units.from ? moment(value, units.from) : moment(value))
          }
          // In this case we'd like to reformat as a string
          // otherwise the moment object is converted to standard JS Date
          if (units.to) {
            date = date.format(units.to)
          } else {
            date = date.toDate()
          }
          value = date
        } else if (units.asString) { // Handle string conversion
          // Convert to a target radix
          if (_.isNumber(units.asString)) value = value.toString(units.asString)
          else value = value.toString()
        } else if (units.asNumber) { // Handle number conversion
          // Remove all spaces as sometimes large numbers are written using a space separator
          // like '120 000' causing the conversion to fail
          if (typeof value === 'string') value = value.replace(/ /g, '')
          value = _.toNumber(value)
        } else { // Handle numbers
          value = unit(value, units.from).toNumber(units.to)
        }
        if (units.asCase && (typeof value === 'string')) { // Handle case conversion as lodash/string function name
          value = (_[units.asCase] ? _[units.asCase](value) : value[units.asCase]())
        }
        // Update converted value
        _.set(object, path, value)
      } else if (_.has(units, 'empty')) {
        _.set(object, path, units.empty)
      }
    })
  })
  // Then iterate over JSON objects to pick/omit properties in place
  for (let i = 0; i < json.length; i++) {
    let object = json[i]
    if (options.pick) {
      object = _.pick(object, options.pick)
    }
    if (options.omit) {
      object = _.omit(object, options.omit)
    }
    if (options.merge) {
      object = _.merge(object, options.merge)
    }
    json[i] = object
  }
  // Transform back to object when required
  if (!isArray) {
    if (!options.asArray) json = (json.length > 0 ? json[0] : {})
  } else {
    if (options.asObject) json = (json.length > 0 ? json[0] : {})
  }
  return json
}