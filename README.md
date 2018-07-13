<p align="center">
  <img alt="OS.js Logo" src="https://raw.githubusercontent.com/os-js/gfx/master/logo-big.png" />
</p>

[OS.js](https://www.os-js.org/) is an [open-source](https://raw.githubusercontent.com/os-js/OS.js/master/LICENSE) desktop implementation for your browser with a fully-fledged window manager, Application APIs, GUI toolkits and filesystem abstraction.

[![Community](https://img.shields.io/badge/join-community-green.svg)](https://community.os-js.org/)
[![Donate](https://img.shields.io/badge/liberapay-donate-yellowgreen.svg)](https://liberapay.com/os-js/)
[![Donate](https://img.shields.io/badge/paypal-donate-yellow.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=andersevenrud%40gmail%2ecom&lc=NO&currency_code=USD&bn=PP%2dDonationsBF%3abtn_donate_SM%2egif%3aNonHosted)
[![Support](https://img.shields.io/badge/patreon-support-orange.svg)](https://www.patreon.com/user?u=2978551&ty=h&u=2978551)

# OS.js v3 Google API Provider

This is the Google API Provider for OS.js v3.

## Installation

In your client initialization script:

```
const GapiServiceProvider = require('@osjs/gapi-provider');

core.register(GapiServiceProvider, {
  args: {
    // These are set for you by default
    src: 'https://apis.google.com/js/api.js',
    libraries: 'client:auth2',
    timeout: 30000,

    // You have to define these
    client: {
      apiKey: '',
      clientId: '',
      discoveryDocs: [],
      scope: []
    }
  }
});
```

## Usage

For example in an application:
```
const onSignedIn = (gapi) => {
  // Do whatever you want here
};

// Get the provider
const osjsgapi = core.make('osjs/gapi').create();

// Remove our event on quit
proc.on('destroy', () => osjsgapi.destroy());

// Attach the logged in event listener
osjsgapi.on('signed-in', onSignedIn);

// Try to log in. This will fire the 'signed-in' event when successful.
osjsgapi.login();
```
