var Observ = require('observ')
var extend = require('xtend')

var NO_TRANSACTION = {}

module.exports = ObservVarhash

function ObservVarhash (hash, createValue) {
  createValue = createValue || function (obj) { return obj }

  var initialState = {}
  var currentTransaction = NO_TRANSACTION

  for (var key in hash) {
    var observ = hash[key]
    checkKey(key)
    initialState[key] = isFn(observ) ? observ() : observ
  }

  var obs = Observ(initialState)
  setNonEnumerable(obs, '_removeListeners', {})

  setNonEnumerable(obs, 'set', obs.set)
  setNonEnumerable(obs, 'get', get.bind(obs))
  setNonEnumerable(obs, 'put', put.bind(obs, createValue))
  setNonEnumerable(obs, 'delete', del.bind(obs))

  for (key in hash) {
    obs[key] = typeof hash[key] === 'function' ?
      hash[key] : createValue(hash[key], key)

    if (isFn(obs[key])) {
      obs._removeListeners[key] = obs[key](watch(obs, key, currentTransaction))
    }
  }

  obs(function (newState) {
    if (currentTransaction === newState) {
      return
    }

    for (var key in hash) {
      var observ = hash[key]

      if (isFn(observ) && observ() !== newState[key]) {
        observ.set(newState[key])
      }
    }
  })

  return obs
}

// access and mutate
function get (key) {
  return this[key]
}

function put (createValue, key, val) {
  checkKey(key)

  if (val === undefined) {
    throw new Error('cannot varhash.put(key, undefined).')
  }

  var observ = typeof val === 'function' ?
    createValue(val, key) : val
  var state = extend(this())

  state[key] = isFn(observ) ? observ() : observ

  if (isFn(this._removeListeners[key])) {
    this._removeListeners[key]()
  }

  this._removeListeners[key] = isFn(observ) ?
    observ(watch(this, key)) : null

  setNonEnumerable(state, '_diff', diff(key, state[key]))

  this[key] = observ
  this.set(state)

  return this
}

function del (key) {
  var state = extend(this())
  if (isFn(this._removeListeners[key])) {
    this._removeListeners[key]()
  }

  delete this._removeListeners[key]
  delete state[key]
  delete this[key]

  setNonEnumerable(state, '_diff', diff(key, undefined))
  this.set(state)

  return this
}

// processing
function watch (obs, key, currentTransaction) {
  return function (value) {
    var state = extend(obs())
    state[key] = value

    setNonEnumerable(state, '_diff', diff(key, value))
    currentTransaction = state
    obs.set(state)
    currentTransaction = NO_TRANSACTION
  }
}

function diff (key, value) {
  var obj = {}
  obj[key] = value && value._diff ? value._diff : value
  return obj
}

function isFn (obj) {
  return typeof obj === 'function'
}

function setNonEnumerable(object, key, value) {
  Object.defineProperty(object, key, {
    value: value,
    writable: true,
    configurable: true,
    enumerable: false
  })
}

// errors
var blacklist = {
  name: 'Clashes with `Function.prototype.name`.',
  get: 'get is a reserved key of observ-varhash method',
  put: 'put is a reserved key of observ-varhash method',
  delete: 'delete is a reserved key of observ-varhash method',
  _diff: '_diff is a reserved key of observ-varhash method',
  _removeListeners: '_removeListeners is a reserved key of observ-varhash'
}

function checkKey (key) {
  if (!blacklist[key]) return
  throw new Error(
    'cannot create an observ-varhash with key `' + key + '`. ' + blacklist[key]
  )
}
