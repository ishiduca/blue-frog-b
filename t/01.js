'use strict'
const test       = require('tape')
const hyperquest = require('hyperquest')
const bl         = require('bl')
const request    = require('blue-frog-core/request')
const rpc        = require('blue-frog-stream')
const body       = require('body/json')

const port = 9999
const uri = `http://0.0.0.0:${port}/rpc/test`

require('./app')(port, (app) => {
    test(`GET http://0.0.0.0:${port}`, t => {
        hyperquest(`http://0.0.0.0:${port}`)
        .pipe(bl(function (err, data) {
            t.is(String(data), '/ not found', 'response body eq "/ not found"')
            t.end()
        }))
    })

    test(`post ${uri} # exsits parse error`, t => {
        const hyp = getHyp((err, _results) => {
            t.notok(err, 'no exists error')
            t.deepEqual(_results
              , {jsonrpc:"2.0", id: null, error: {code: -32700, message: "Parse error", data: "SyntaxError: Unexpected token i"}}
              , 'results deepEqual {jsonrpc:"2.0", id: null, error: {code: -32700, message: "Parse error", data: "SyntaxError: Unexpected token i"}}'
            )
            t.end()
        })

        hyp.end('invalid value')
    })

    test(`post ${uri} # exsits invalid request(required method not found)`, t => {
        const hyp = getHyp((err, _results) => {
            t.notok(err, 'no exists error')
            t.is(_results.length, 2, 'get 2 response objects')
            const results = _results.reduce((x, a) => {x[String(a.id)] = a; return x}, {})
            t.deepEqual(results["123"], {jsonrpc: "2.0", id: 123, result: [3,2,1]}, 'id 123 -> result [3,2,1]')
            t.deepEqual(results["456"]
              , {jsonrpc: "2.0", id: 456, error: {code: -32600, message: "Invalid Request", data: 'Error: required method "jsonrpc" not found'}}
              , 'id 456 -> error code -32600, message "Invalid Request"'
            )
            t.end()
        })

        hyp.end(JSON.stringify([
            {jsonrpc: "2.0", id: 123, method: "reverse", params: [1,2,3]}
          , {xsonrpc: "2.0", id: 456, method: "sum", params: [1,2]}
        ]))
    })

    test(`post ${uri} # exsits method not found`, t => {
        const hyp = getHyp((err, _results) => {
            t.notok(err, 'no exists error')
            t.is(_results.length, 2, 'get 2 response objects')
            const results = _results.reduce((x, a) => {x[String(a.id)] = a; return x}, {})
            t.deepEqual(results["123"], {jsonrpc: "2.0", id: 123, result: [3,2,1]}, 'id 123 -> result [3,2,1]')
            t.deepEqual(results["456"]
              , {jsonrpc: "2.0", id: 456, error: {code: -32601, message: "Method not found", data: 'method "no exists method" not found :('}}
              , 'id 456 -> error code -32601, message "Method no found"'
            )
            t.end()
        })

        hyp.end(JSON.stringify([
            {jsonrpc: "2.0", id: 123, method: "reverse", params: [1,2,3]}
          , {jsonrpc: "2.0", id: 456, method: "no exists method"}
        ]))
    })

    test(`post ${uri} # exsits invalid params`, t => {
        const hyp = getHyp((err, _results) => {
            t.notok(err, 'no exists error')
            t.is(_results.length, 2, 'get 2 response objects')
            const results = _results.reduce((x, a) => {x[String(a.id)] = a; return x}, {})
            t.deepEqual(results["123"], {jsonrpc: "2.0", id: 123, result: 6}, 'id 123 -> result 6')
            t.deepEqual(results["456"]
              , {jsonrpc: "2.0", id: 456, error: {code: -32602, message: "Invalid params", data: "TypeError: Cannot read property 'slice' of undefined"}}
              , 'id 456 -> error code -32602, message "Invalid params"'
            )
            t.end()
        })

        hyp.end(JSON.stringify([
            {jsonrpc: "2.0", id: 123, method: "multi", params: [1,2,3]}
          , {jsonrpc: "2.0", id: 456, method: "reverse"}
        ]))
    })

    test(`POST ${uri}`, t => {
        let start
        let finish
        const batch = setup((err, results) => {
            finish = Date.now()
            t.notOk(err, 'no exists error')
            t.is(results.length, 3, 'get 3 success')
            t.deepEqual(results[0], {jsonrpc: "2.0", id: 123, result: 6}, 'id 123 -> result: 6')
            t.deepEqual(results[1], {jsonrpc: "2.0", id: 456, result: 120}, 'id 456 -> result: 120')
            t.deepEqual(results[2], {jsonrpc: "2.0", id: 789, result: [9,8,7]}, 'id 789 -> result: [9,8,7]')
            const time = finish - start
            t.ok(time < 1000, `batch processing time < 1000msec. time: ${time}`)
            t.end()
        })

        batch.once('end', () => {start = Date.now()})

        batch.write(request(123, 'sum', [1,2,3]))
        batch.write(request(456, 'multi', [4, 5, 6]))
        batch.end(  request(789, 'reverse', [7,8,9]))
    })

    test(`POST ${uri} # with notification`, t => {
        const batch = setup((err, results) => {
            t.notOk(err, 'no exists error')
            t.is(results.length, 2, 'get 2 success')
            t.deepEqual(results[0], {jsonrpc: "2.0", id: 123, result: 6}, 'id 123 -> result: 6')
            t.deepEqual(results[1], {jsonrpc: "2.0", id: 456, result: 120}, 'id 456 -> result: 120')
            t.end()
        })

        batch.write(request(123, 'sum', [1,2,3]))
        batch.write(request(456, 'multi', [4, 5, 6]))
        batch.end(  request.notification('reverse', [7,8,9]))
    })

    test(`POST ${uri} # only notification`, t => {
        app.once('close', () => setTimeout(() => t.end(), 500))

        const batch = setup((err, results) => {
            t.ok(1, 'get http.response')
            t.ok(/SyntaxError.*?Unexpected end of input/.test(String(err)), 'only notification then response.body is empty - ' + String(err))
            app.close()
        })

        batch.write(request.notification('sum', [1,2,3]))
        batch.write(request.notification('multi', [4, 5, 6]))
        batch.end(  request.notification('reverse', [7,8,9]))
    })
})

function getHyp (test) {
    const hyp = hyperquest.post(uri)
    hyp.once('response', res => body(res, null, test))
    return hyp
}

function setup (test) {
    const batch = new rpc.request.BatchStream(true)
    batch.pipe(getHyp(test))
    return batch
}
