/*
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) Anders Evenrud <andersevenrud@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @author  Anders Evenrud <andersevenrud@gmail.com>
 * @licence Simplified BSD License
 */

/*
 * Alias
 */
const gapiAuthInstance = () => window.gapi.auth2.getAuthInstance();

/*
 * Creates gapi client instance
 */
const createGapiClient = options => {
  const opts = Object.assign({
    apiKey: null,
    clientId: null,
    discoveryDocs: [],
    scope: []
  }, options);

  opts.scope = opts.scope.join(' ');

  // If these are not correct we just get some lame 404s from google

  if (!opts.apiKey || !opts.clientId) {
    throw new Error('gapi client requires apiKey and clientId');
  }

  if (!opts.discoveryDocs.length) {
    throw new Error('gapi client requires discoveryDocs');
  }

  if (!opts.scope.length) {
    throw new Error('gapi client requires scope');
  }

  return window.gapi.client.init(opts);
};

/*
 * Loads the gapi client
 */
const loadGapiClient = (libraries, timeout) => new Promise((resolve, reject) => {
  if (libraries) {
    console.debug('Loading gapi client with', libraries);

    window.gapi.load(libraries, {
      timeout,
      callback: () => resolve(),
      onerror: err => reject(new Error(err)),
      ontimeout: () => reject(new Error('Timed Out')) // FIXME
    });
  } else {
    // Not spesifying just makes 404s at google
    reject(new Error('gapi load requires libraries'));
  }
});

/**
 * Google API Service Provider
 * @desc Provides gapi
 */
export class GapiServiceProvider {

  constructor(core, options) {
    this.options = Object.assign({
      src: 'https://apis.google.com/js/api.js',
      timeout: 30000,
      libraries: 'client:auth2',
      client: {}
    }, options);

    this.core = core;
    this.signedIn = false;
    this.loaded = false;
    this.clients = [];
    this.bus = null;
  }

  /**
   * Destroys the service provider
   */
  destroy() {
    this.emitAll('destroy');

    this.clients = this.client.filter(c => c.destroy());

    this.tray = this.tray.destroy();
    this.bus = this.bus.destroy();
  }

  /**
   * Initializes the service provider
   * @desc Exposes and binds api stuff
   */
  init() {
    this.core.singleton('google/api', () => {
      if (!('gapi' in window)) {
        throw new Error('gapi was not loaded');
      }

      return window.gapi;
    });

    this.core.singleton('osjs/gapi', () => ({
      login: () => this.login(),
      logout: () => this.login(),
      create: () => this.createInstance()
    }));
  }

  /**
   * Get a list of provided services
   */
  provides() {
    return ['google/api', 'osjs/gapi'];
  }

  /**
   * Start the service provider
   * @see GapiServiceProvider#createApi
   */
  start() {
    this.createTray();

    return this.createApi();
  }

  /**
   * Creates tray icon
   */
  createTray() {
    this.tray = this.core.make('osjs/tray').create({
      title: 'Google API',
      icon: require('./logo.svg')
    }, ev => {
      this.core.make('osjs/contextmenu').show({
        position: ev.target,
        menu: [{
          label: 'Scopes',
          items: this.options.client.scope.map(s => ({
            label: s
          }))
        }, {
          label: 'Sign In',
          disabled: this.signedIn,
          onclick: () => this.login()
        }, {
          label: 'Sign Out',
          disabled: !this.signedIn,
          onclick: () => this.logout()
        }]
      });
    });

    this.bus = this.core.make('osjs/event-handler', 'gapi');

    this.bus.on('signed-in', () => {
      this.core.make('osjs/notification', {
        icon: require('./logo.svg'),
        title: 'Google API',
        message: 'You have signed on to Google'
      });

      this.emitAll('signed-in');
    });

    this.bus.on('signed-out', () => {
      this.loaded = false;

      this.emitAll('signed-out');
    });
  }

  /**
   * Creates google api
   * @return Promise
   */
  createApi() {
    const {src, libraries, timeout, client} = this.options;
    const {script} = this.core.make('osjs/dom');
    const {$resourceRoot} = this.core;

    return script($resourceRoot, src)
      .then(() => loadGapiClient(libraries, timeout))
      .then(() => createGapiClient(client))
      .then(() => this.listen());
  }

  /**
   * Creates a new instance that we return from service
   * @desc It's jus a small wrapper with a bus attached
   * @return {Object}
   */
  createInstance() {
    const bus = this.core.make('osjs/event-handler', 'gapi-client');

    this.clients.push(bus);

    return {
      login: () => this.login(),
      logout: () => this.logout(),
      on: (...args) => bus.on(...args),
      off: (...args) => bus.off(...args),
      destroy: () => {
        const foundIndex = this.clients.find(b => b === bus);
        if (foundIndex !== -1) {
          this.clients.splice(foundIndex, 1);
        }

        bus.destroy();
      }
    };
  }

  /**
   * Emits events across all created instances
   * @see EventHandler#emit
   */
  emitAll(name, ...args) {
    args.push(window.gapi);

    this.clients.forEach(bus => bus.emit(name, ...args));
  }

  /**
   * Sets up the gapi auth listening
   */
  listen() {
    const emit = () => this.bus.emit(this.signedIn ? 'signed-in' : 'signed-out');

    if (!this.loaded) {
      gapiAuthInstance().isSignedIn.listen(s => {
        this.signedIn = s;

        emit();
      });

      this.signedIn = gapiAuthInstance().isSignedIn.get();

      emit();
    }

    this.loaded = true;
  }

  /**
   * Perform login
   * @return Promise
   */
  login() {
    if (!this.signedIn) {
      return gapiAuthInstance().signIn()
        .then(() => window.gapi);
    }

    return Promise.resolve(window.gapi);
  }

  /**
   * Perform logout
   * @return Promise
   */
  logout() {
    if (this.signedIn) {
      return gapiAuthInstance().signOut()
        .then(() => window.gapi);
    }

    return Promise.resolve(window.gapi);
  }
}

