{expect} = require '../util'
{adapter} = require '../util/store'

# `adapter('db', block)` generates the exported
# function (dbOptions, plugin, moreTests)
# that runs `block` for the given `plugin`
module.exports = adapter 'db', (run) ->

  run 'query', {noFlush: true}, require './query'
  run 'store mutators', require './storeMutators'

  run 'db flushing', (getStore) ->
    it 'should delete all db contents', (done) ->
      store = getStore()
      store.set 'color', 'green', 1, (err) ->
        expect(err).to.be.null()
        store.get 'color', (err, value, ver) ->
          expect(err).to.be.null()
          expect(value).to.equal('green')
          store.flushDb (err) ->
            expect(err).to.be.null()
            store.get 'color', (err, value, ver) ->
              expect(err).to.be.null()
              expect(value).to.be(undefined)
              done()
