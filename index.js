const defaultSyncConfig = {
  passthroughQuery: false,
  params: {},
  beforeInit() {},
  beforeRead() {},
  afterRead() {},
  beforeWrite() {},
  afterWrite() {},
};

const defaultParamConfig = {
  read(query) {},
  write(query) {},
};

function computedQueryParams() {
  const options = this.$_querySync;
  if (!options) return {};

  let params = {};
  for (let key of Object.keys(options.params)) {
    options.params[key].write.call(this, params);
  }

  return params;
}

function debounce(fn, delay=0) {
  let timer;
  return function() {
    const callTarget = this;
    const callArgs = arguments;
    clearTimeout(timer);
    timer = setTimeout(function() {
      fn.apply(callTarget, callArgs);
      timer = null;
    }, delay);
  };
}

export default {
  install(Vue, options) {
    for (let key of ['$router', '$route']) {
      if (!Vue.prototype.hasOwnProperty(key)) {
        throw('Vue Router must be installed before query sync');
      }
    }

    Vue.prototype.$_querySync = null;

    // Reads fields from the query and assigns them to the view.
    Vue.prototype.$readQuery = function() {
      const options = this.$_querySync;
      if (!options) return;
      options.beforeRead.call(this);

      for (let key of Object.keys(options.params)) {
        options.params[key].read.call(this, this.$route.query);
      }

      options.afterRead.call(this);
    };

    // Writes fields from the view into the query.
    Vue.prototype.$writeQuery = debounce(function() {
      const options = this.$_querySync;
      if (!options) return;

      let query = options.passthroughQuery ? Object.assign({}, this.$route.query) : {};
      for (let key of Object.keys(options.params)) {
        options.params[key].write.call(this, query);
      }

      options.beforeWrite.call(this);
      this.$router.replace({ query });
      options.afterWrite.call(this);
    });

    Vue.mixin({
      // Read configuration from querySync options,
      // build operations with defaulted presents.
      beforeCreate() {
        let options = this.$options.querySync;
        if (!options) return;

        options = Object.assign({}, defaultSyncConfig, options);
        for (let key of Object.keys(options.params)) {
          options.params[key] = Object.assign({}, defaultParamConfig, options.params[key]);
        }

        this.$_querySync = options;

        // add a "queryParams" computed that provides rendered data
        if (!this.$options.computed.hasOwnProperty('queryParams')) {
          this.$options.computed.queryParams = computedQueryParams;
        }
      },

      // read initial configuration from the URL
      created() {
        const options = this.$_querySync;
        if (!options) return;

        options.beforeInit.call(this);
        this.$readQuery();
      },

      // Setup watchers and pull initial route.
      mounted() {
        const options = this.$_querySync;
        if (!options) return;

        for (let key of Object.keys(options.params)) {
          this.$watch(key, this.$writeQuery);
        }

        this.$watch('$route.query', this.$readQuery);
        this.$writeQuery();
      }
    });
  }
};
