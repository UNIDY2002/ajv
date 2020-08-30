import {CodeKeywordDefinition} from "../../types"
import KeywordContext from "../../compile/context"
import {propertyInData, noPropertyInData} from "../util"
import {checkReportMissingProp, checkMissingProp, reportMissingProp} from "../missing"
import {_, str, Name} from "../../compile/codegen"

const def: CodeKeywordDefinition = {
  keyword: "required",
  type: "object",
  schemaType: ["array"],
  $data: true,
  code(cxt: KeywordContext) {
    const {gen, schema, schemaCode, data, $data, it} = cxt
    if (!$data && schema.length === 0) return
    const loopRequired = $data || schema.length >= <number>it.opts.loopRequired
    if (it.allErrors) allErrorsMode()
    else exitOnErrorMode()

    function allErrorsMode(): void {
      if (loopRequired) {
        if ($data) {
          gen.if(_`${schemaCode} !== undefined`, () => {
            gen.if(_`Array.isArray(${schemaCode})`, loopAllRequired, () => cxt.$dataError())
          })
        } else {
          loopAllRequired()
        }
        return
      }
      for (const prop of schema) {
        checkReportMissingProp(cxt, prop)
      }
    }

    function exitOnErrorMode(): void {
      const missing = gen.let("missing")
      if (loopRequired) {
        const valid = gen.let("valid", true)
        if ($data) {
          gen.if(_`${schemaCode} === undefined`)
          gen.assign(valid, true)
          gen.elseIf(_`!Array.isArray(${schemaCode})`)
          cxt.$dataError()
          gen.assign(valid, false)
          gen.else()
          loopUntilMissing(missing, valid)
          gen.endIf()
        } else {
          loopUntilMissing(missing, valid)
        }
        cxt.ok(valid)
      } else {
        gen.if(checkMissingProp(cxt, schema, missing))
        reportMissingProp(cxt, missing)
        gen.else()
      }
    }

    function loopAllRequired(): void {
      const prop = gen.name("prop")
      cxt.setParams({missingProperty: prop})
      gen.for(_`const ${prop} of ${schemaCode}`, () =>
        gen.if(noPropertyInData(data, prop, it.opts.ownProperties), () => cxt.error())
      )
    }

    function loopUntilMissing(missing: Name, valid: Name): void {
      cxt.setParams({missingProperty: missing})
      gen.for(_`${missing} of ${schemaCode}`, () => {
        gen.assign(valid, propertyInData(data, missing, it.opts.ownProperties))
        gen.ifNot(valid, () => {
          cxt.error()
          gen.break()
        })
      })
    }
  },
  error: {
    message: ({params: {missingProperty}}) =>
      str`should have required property '${missingProperty}'`,
    params: ({params: {missingProperty}}) => _`{missingProperty: ${missingProperty}}`,
  },
  $dataError: {
    message: '"required" keyword value must be array',
  },
}

module.exports = def
