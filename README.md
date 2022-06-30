<p align="left">
 <img width="300" src="logo/homebridge-wallbox.png" />
</p>

# homebridge-my-wallbox
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
<br>Wallbox platform plugin for [Homebridge](https://github.com/nfarina/homebridge).

## About

<br> Supports the ablity to lock and unlock charger from HomeKit
<br> If you have more than one home on account you may filter chargers for a home based on the location name assigned in the Wallbox app for the location you want to display in HomeKit.

This plugin has been tested or verified against hardware model/types
- Wallbox Pulsar
- Only been tested to date with email based accounts, Google and Apple logins are not currently supported. 

Other hardware models/types may still work with this plugin and any feedback on devices not listed is welcome.

## Installation
1. Install this plugin using: npm install -g homebridge-mywallbox
3. Use plugin settings to edit ``config.json`` and add your account info.
4. Run Homebridge
5. Pair to HomeKit

## Config.json example with child bridge
```
{
	"name": "Wallbox",
	"email": "username@email.com",
	"password": "password",
	"refreshRate": 30,
	"cars": [
		{
			"carName": "My EV",
			"chargerName": "Wallbox",
			"kwH": 78
		}
	],
	"locationAddress": "123 Easy St",
	"showControls": 4,
	"_bridge": {
		"username": "0E:6C:D4:F2:16:EB",
		"port": 35919
	},
	"platform": "wallbox"
}
```