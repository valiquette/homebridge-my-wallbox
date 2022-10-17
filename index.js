const PlatformWallbox = require('./wallboxplatform')
const package = require('./package')

module.exports = (homebridge) => {
  PlatformAccessory = homebridge.platformAccessory
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  UUIDGen = homebridge.hap.uuid
  PluginName = package.name
	PluginVersion = package.version
  PlatformName = 'wallbox'

  homebridge.registerPlatform(PluginName, PlatformName, PlatformWallbox, true)
}