import type { API } from 'homebridge';
import { wallboxPlatform } from './wallboxplatform.js';
import { PLATFORM_NAME } from './settings.js';

export default (api: API) => {
	api.registerPlatform(PLATFORM_NAME, wallboxPlatform);
};