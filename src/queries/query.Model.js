var ModelQueryBuilder = require('./ModelQueryBuilder')
  , QueryBuilder = require('./QueryBuilder')
  , path = require('../path')
  , splitPath = path.split
  , expandPath = path.expand
  ;

module.exports = {
  type: 'Model'
, events: {
    init: function (model) {
      // maps hash -> 1
      model._privateQueries = {}

      // maps hash ->
      //        query: QueryBuilder
      //        memoryQuery: MemoryQuery
      model._queries = {}
    }
  }
, proto: {

    query: function (namespace, queryParams) {
      queryParams || (queryParams = {});
      queryParams.from = namespace;
      return new ModelQueryBuilder(queryParams, this);
    }

  , findOne: function (namespace, queryParams) {
      queryParams || (queryParams = {});
      queryParams.from = namespace;
      return (new ModelQueryBuilder(queryParams, this)).findOne();
    }

  , find: function (namespace, queryParams) {
      queryParams || (queryParams = {});
      queryParams.from = namespace;
      return (new ModelQueryBuilder(queryParams, this)).find();
    }

    // fetch(targets..., callback)
  , fetch: function () {
      this._compileTargets(arguments, {
        compileModelAliases: true
      , eachQueryTarget: function (queryJson, addToTargets) {
          addToTargets(queryJson);
        }
      , eachPathTarget: function (path, addToTargets) {
          addToTargets(path);
        }
      , done: function (targets, modelAliases, fetchCb) {
          var self = this;
          this._fetch(targets, function (err, data) {
              self._addData(data);
              fetchCb.apply(null, [err].concat(modelAliases));
          });
        }
      });
    }

  , _fetch: function (targets, cb) {
      if (!this.connected) return cb('disconnected');
      this.socket.emit('fetch', targets, cb);
    }

    // _arguments is an Array-like arguments whose members are either
    // QueryBuilder instances or Strings that represent paths or path patterns
  , _compileTargets: function (_arguments, opts) {
      var arglen = _arguments.length
        , last = _arguments[arglen-1]
        , argumentsHaveCallback = (typeof last === 'function')
        , cb = argumentsHaveCallback ? last : noop

        , newTargets = []

        , eachQueryTarget = opts.eachQueryTarget
        , eachPathTarget = opts.eachPathTarget
        , done = opts.done;

      if (opts.compileModelAliases) {
        var modelAliases = []
          , aliasPath;
      }

      function addToTargets (target) {
        newTargets.push(target);
      }

      var i = argumentsHaveCallback ? arglen-1 : arglen;
      // Transform incoming targets into full set of `newTargets`.
      // Compile the list `out` of model aliases representative of the fetched
      // results, to pass back to the callback `cb`
      while (i--) {
        var target = _arguments[i];
        if (target instanceof QueryBuilder || target instanceof ModelQueryBuilder) {
          var queryJson = target.toJSON();
          if (modelAliases) aliasPath = '_$queries.' + QueryBuilder.hash(queryJson) + '._results';
          eachQueryTarget.call(this, queryJson, addToTargets, aliasPath);
          newTargets.push(queryJson);
        } else { // Otherwise, target is a path or model alias
          if (target._at) target = target._at;
          if (modelAliases) aliasPath = splitPath(target)[0];
          var paths = expandPath(target);
          for (var k = paths.length; k--; ) {
            var path = paths[k];
            eachPathTarget.call(this, path, addToTargets, aliasPath);
          }
        }
        if (modelAliases) {
          modelAliases.push(this.at(aliasPath, true));
        }
      }

      if (modelAliases) {
        done.call(this, newTargets, modelAliases, cb);
      } else {
        done.call(this, newTargets, cb);
      }
    }
  }
, server: {
    _fetch: function (targets, cb) {
      var store = this.store;
      this._clientIdPromise.on( function (err, clientId) {
        if (err) return cb(err);
        store.fetch(clientId, targets, cb);
      });
    }
  }
};
