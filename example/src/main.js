'use strict'
var hyperquest = require('hyperquest')
var frog       = require('blue-frog-b')
var rpc        = require('blue-frog-stream')

window.onload = function () {
    var hyp    = hyperquest.post(location.origin + '/rpc')
    var stream = frog()

    var sum = stream.request('sum', [1,2,3,4])
    var mul = stream.request('multi', [5,6,7])

    hyp.on('error', onError)
    stream.on('error', onError)
    sum.on('error', onError)
    mul.on('error', onError)

    sum.once('data', function (result) {
        console.log('sum(1, 2, 3, 4) => %s', result)
    })
    mul.once('data', function (result) {
        console.log('multi(5, 6, 7) => %s', result)
    })

    stream
        .pipe(new rpc.request.BatchStream(true))
        .pipe(hyp)
        .pipe(stream)

    stream.batch([sum, mul])
}

function onError (err) {
    console.log(err)
    err.data && console.log(data)
}
