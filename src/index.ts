import type { API } from 'homebridge';
import { PLATFORM_NAME } from './settings.js';
import wallboxPlatform from './wallboxplatform.js';

export default (api: API) => {
	api.registerPlatform(PLATFORM_NAME, wallboxPlatform);
};