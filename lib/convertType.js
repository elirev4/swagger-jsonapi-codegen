const _                = require('lodash')
const generateEnumName = require('./generateEnumName')

var self = {
  enumerations: [],
  /**
   * Recursively converts a swagger type description into a typescript type, i.e., a model for our mustache
   * template.
   *
   * Not all type are currently supported, but they should be straightforward to add.
   *
   * @param swaggerType a swagger type definition, i.e., the right hand side of a swagger type definition.
   * @param swagger
   * @returns object a recursive structure representing the type, which can be used as a template model.
   */
  convertType: function (swaggerType, swagger) {
    let typespec = {description: swaggerType.description, isEnum: false}

    if (swaggerType.hasOwnProperty('schema')) {
      return self.convertType(swaggerType.schema)
    }
    else if (_.isString(swaggerType.$ref)) {
      typespec.tsType = 'ref'
      typespec.target = swaggerType.$ref.substring(swaggerType.$ref.lastIndexOf('/') + 1)
    }
    else if (swaggerType.hasOwnProperty('enum')) {
      typespec.tsType   = generateEnumName(swaggerType.name)
      typespec.isAtomic = true
      typespec.isEnum   = true
      typespec.enum     = swaggerType.enum

      self.enumerations.push(typespec)
    }
    else if (swaggerType.type === 'string') {
      typespec.tsType = 'string'
    }
    else if (swaggerType.type === 'number' || swaggerType.type === 'integer') {
      typespec.tsType = 'number'
    }
    else if (swaggerType.type === 'boolean') {
      typespec.tsType = 'boolean'
    }
    else if (swaggerType.type === 'array') {
      typespec.tsType      = 'array'
      typespec.elementType = self.convertType(swaggerType.items)
    }
    else /*if (swaggerType.type === 'object')*/ { //remaining types are created as objects
      if (swaggerType.minItems >= 0 && swaggerType.hasOwnProperty('title') && !swaggerType.$ref) {
        typespec.tsType = 'any'
      }
      else {
        typespec.tsType     = 'object'
        typespec.properties = []

        if (swaggerType.allOf) {
          _.forEach(swaggerType.allOf, function (ref) {
            if (ref.$ref) {
              let refSegments = ref.$ref.split('/')
              let name        = refSegments[refSegments.length - 1]
              _.forEach(swagger.definitions, function (definition, definitionName) {
                if (definitionName === name) {
                  var property = self.convertType(definition, swagger)
                  typespec.properties.push(...property.properties)
                }
              })
            }
            else {
              var property = self.convertType(ref)
              typespec.properties.push(...property.properties)
            }
          })
        }

        _.forEach(swaggerType.properties, function (propertyType, propertyName) {

          var property  = self.convertType(propertyType)
          property.name = propertyName

          if (swaggerType.required && typeof _.isArray(swaggerType)) {

            swaggerType.required.forEach(function (requiredPropertyName) {

              if (propertyName === requiredPropertyName) {
                property.isRequired = true
              }
            })
          }

          if (!property.isRequired) {
            property.isOptional = true
          }

          typespec.properties.push(property)
        })

        let hasIdProperty = false

        typespec.properties.forEach((prop) => {
          if (prop.name === 'id') {
            hasIdProperty = true
          }
        })

        // This breaks nested body object and not used except for declaring paramters
        // add only if not already added
        //if (!hasIdProperty) {
        //  // every model has an id
        //  typespec.properties.push({
        //    description: 'Unique id',
        //    isEnum: false,
        //    tsType: 'number',
        //    isRef: false,
        //    isObject: false,
        //    isArray: false,
        //    isAtomic: true,
        //    name: 'id',
        //    isOptional: false
        //  })
        //}
      }
    }
    /*else {
     // type unknown or unsupported... just map to 'any'...
     typespec.tsType = 'any';
     }*/

    // Since Mustache does not provide equality checks, we need to do the case distinction via explicit booleans
    typespec.isRef    = typespec.tsType === 'ref'
    typespec.isObject = typespec.tsType === 'object'
    typespec.isArray  = typespec.tsType === 'array'
    typespec.isAtomic = typespec.isAtomic || _.includes(['string', 'number', 'boolean', 'any'], typespec.tsType)

    return typespec
  }
}

module.exports = self