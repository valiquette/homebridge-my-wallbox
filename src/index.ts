import type { API } from 'homebridge';

//import { wallboxPlatform } from './wallboxplatform.js';
import wallboxPlatform from './wallboxplatform.js';
import { PLATFORM_NAME } from './settings.js';
import { PLUGIN_NAME } from './settings.js';
import { PLUGIN_VERSION } from './settings.js';
/**
 * This method registers the platform with Homebridge
 */
export default (api: API) => {
	let PluginName = PLUGIN_NAME
	let PluginVersion = PLUGIN_VERSION
	let UUIDGen = api.hap.uuid
	api.registerPlatform(PLATFORM_NAME, wallboxPlatform);
};


/*
module.exports = homebridge => {
	PlatformAccessory = homebridge.platformAccessory
	Service = homebridge.hap.Service
	Characteristic = homebridge.hap.Characteristic
	UUIDGen = homebridge.hap.uuid
	PluginName = packageJson.name
	PluginVersion = packageJson.version
	PlatformName = 'wallbox'
	homebridge.registerPlatform(PluginName, PlatformName, PlatformWallbox, true)
}
	*/