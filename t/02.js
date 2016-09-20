'use strict'
const test       = require('tape')
const hyperquest = require('hyperquest')
const rpc        = require('blue-frog-stream')
const frog       = require('../browser')

const port = 9998
const uri  = `http://0.0.0.0:${port}/rpc/test`

require('./app')(port, (app) => {
    test(`POST ${uri}`, t => {
        var spy  = []
        var errs = []
        var hyp  = hyperquest.post(uri)
        var b    = frog()
        var sum  = b.request('sum',   [2,3,4])
        var mul  = b.request('multi', [2,3,4])
        var rev  = b.request('reverse', [7,8,9])

        b.pipe(new rpc.request.BatchStream(true))
         .pipe(hyp)
         .pipe(b)

        b.on('error', onError)
        hyp.on('error', onError)
        sum.on('error', onError)
        mul.on('error', onError)
        rev.on('error', onError)

        sum.on('data', function (result) {
            spy.push({method: 'sum', result: result})
        })
        mul.on('data', function (result) {
            spy.push({method: 'multi', result: result})
        })
        rev.on('data', function (result) {
            spy.push({method: 'reverse', result: result})
        })

        b.once('parseEnd', function () {
            t.ok(true, '"parseEnd" event is emited')
            t.is(errs.length, 0, 'no existe error')
            t.is(spy.length, 3, 'get 3 response(success)')
            t.is(spy[0].result, 9, 'method "sum" -> result 9')
            t.is(spy[1].result, 24, 'method "multi" -> result 24')
            t.deepEqual(spy[2].result, [9,8,7], 'method "reverse" -> result [9,8,7]')
            t.end()
        })

        b.batch([sum, mul, rev])

        function onError (err) {
            errs.push(err)
        }
    })

    test(`POST ${uri} # exists invalid params, exists success`, t => {
        var spy  = []
        var errs = []

        var b = getClient(function () {
            t.is(errs.length, 1, 'get 1 error')
            t.is(errs[0].code, -32602, 'error.code eq -32602')
            t.is(errs[0].message, 'Invalid params', 'error.message "Invalid params"')
            t.ok(/TypeError.*?params/.test(errs[0].data), 'error.data ' + errs[0].data)
            t.is(spy.length, 1, 'get 1 response(success)')
            t.is(spy[0].result, 24, 'method "multi" -> result 24')
            t.end()

        }).on('error', onError)

        var sum  = b.request('sum',   {a: 1}).on('error', onError)
        var mul  = b.request('multi', [2,3,4]).on('error', onError)

        sum.on('data', function (result) {
            spy.push({method: 'sum', result: result})
        })
        mul.on('data', function (result) {
            spy.push({method: 'multi', result: result})
        })

        b.batch([sum, mul])

        function onError (err) {
            errs.push(err)
        }
    })

    test(`POST ${uri} # exists errors, no exists success`, t => {
        var spy  = []
        var errs = []

        var b = getClient(function () {
            t.is(errs.length, 2, 'get 2 error')
            t.is(errs[0].code, -32602, 'error.code eq -32602')
            t.is(errs[0].message, 'Invalid params', 'error.message "Invalid params"')
            t.is(errs[1].code, -32601, 'error.code eq -32601')
            t.is(errs[1].message, 'Method not found', 'error.message "Method not found"')
            t.is(spy.length, 0, 'get 0 response(success)')
            t.end()

        }).on('error', onError)

        var sum  = b.request('sum',   {a: 1}).on('error', onError)
        var mul  = b.request('xMulti', {ab: 1}).on('error', onError)

        sum.on('data', function (result) {
            spy.push({method: 'sum', result: result})
        })
        mul.on('data', function (result) {
            spy.push({method: 'multi', result: result})
        })

        b.batch([sum, mul])

        function onError (err) {
            errs.push(err)
        }
    })

    test(`POST ${uri} # exists errors, no exists success`, t => {
        var spy  = []
        var errs = []

        var b = getClient(function () {
            t.is(errs.length, 2, 'get 2 error')
            t.is(errs[0].code, -32602, 'error.code eq -32602')
            t.is(errs[0].message, 'Invalid params', 'error.message "Invalid params"')
            t.is(errs[1].code, -32601, 'error.code eq -32601')
            t.is(errs[1].message, 'Method not found', 'error.message "Method not found"')
            t.is(spy.length, 0, 'get 0 response(success)')
            app.close()
            t.end()

        }).on('error', onError)

        var sum  = b.notification('sum',   {a: 1}).on('error', onError)
        var mul  = b.notification('xMulti', {ab: 1}).on('error', onError)

        sum.on('data', function (result) {
            spy.push({method: 'sum', result: result})
        })
        mul.on('data', function (result) {
            spy.push({method: 'multi', result: result})
        })

        b.batch([sum, mul])

        function onError (err) {
            errs.push(err)
        }
    })
})

function getClient (test, onfin) {
    var hyp  = hyperquest.post(uri)
    var b    = frog()

    b.pipe(new rpc.request.BatchStream(true))
     .pipe(hyp)
     .pipe(b)

    test  && b.once('parseEnd', test)
    onfin && b.once('finish', onfin)

    return b
}
