<p align="left">
 <img width="300" src="logo/homebridge-wallbox.png" />
</p>

# homebridge-my-wallbox
<br>Wallbox platform plugin for [Homebridge](https://github.com/nfarina/homebridge).

## About


<br> Supports the ablity to lock and unlock charger from HomeKit

## Notes on testing

This plugin has been tested or verified against hardware model/types
- Wallbox Pulsar
- Only been tested to date with email accounts, Google and Apple log in have not been tested

Other hardware models/types may still work with this plugin and any feedback on devices not listed is welcome.

## Installation
1. Install this plugin using: npm install -g homebridge-mywallbox
3. Use plugin settings to edit ``config.json`` and add your account info.
4. Run Homebridge
5. Pair to HomeKit

## Config.json example with child bridge
```
"platforms": [
	{
			"name": "Wallbox",
			"email": "username@email.com",
			"password": "password",
			"_bridge": {
					"username": "0E:6C:D4:F2:16:EB",
					"port": 35919
			},
			"platform": "wallbox"
	}
]
```