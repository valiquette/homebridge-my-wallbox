/* eslint-disable @typescript-eslint/no-explicit-any */

'use strict';

import type { Service, Characteristic } from 'homebridge';
import { wallboxPlatform } from './wallboxplatform.js';
import * as rax from 'retry-axios';
import axios from 'axios';
import { PLUGIN_NAME, PLUGIN_VERSION } from './settings.js';

const userEndpoint = 'https://user-api.wall-box.com';
const endpoint = 'https://api.wall-box.com';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const interceptorId = rax.attach();

export default class wallboxAPI {
	public readonly Service!: typeof Service;
	public readonly Characteristic!: typeof Characteristic;
	constructor(
		private readonly platform: wallboxPlatform,
	) {}

	async checkEmail(email: any) {
		this.platform.apiCount++;
		this.platform.log.debug('Retrieving device');
		const response = await axios({
			method: 'get',
			baseURL: userEndpoint,
			url: `/users/emails/${email}`,
			headers: {
				'Content-Type': 'application/json',
				Partner: 'wallbox',
				'User-Agent': `${PLUGIN_NAME}/${PLUGIN_VERSION}`,
				'Accept-Encoding': 'gzip,deflate,compress',
			},
			responseType: 'json',
			raxConfig: {
				retry: 3,
				retryDelay: 100,
				backoffType: 'exponential',
				onRetryAttempt: async (err) => {
					const cfg: any = rax.getConfig(err);
					this.platform.log.warn(`${err.message} retrying checking email , attempt #${cfg.currentRetryAttempt}`);
				},
			},
		}).catch(err => {
			this.platform.log.debug(JSON.stringify(err, null, 2));
			this.platform.log.error('Error checking email %s', err.message);
			throw err.code;
		});
		if (response.status === 200) {
			if (this.platform.showAPIMessages) {
				this.platform.log.debug('check email response', JSON.stringify(response.data, null, 2));
			}
			return response.data;
		}
		return response;
	}

	async signin(email: string, password: string) {
		this.platform.apiCount++;
		const b64encoded = Buffer.from(email + ':' + password, 'utf8').toString('base64');
		this.platform.log.debug('Retrieving token');
		const response = await axios({
			method: 'get',
			baseURL: userEndpoint,
			url: '/users/signin',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Basic ${b64encoded}`,
				Partner: 'wallbox',
				'User-Agent': `${PLUGIN_NAME}/${PLUGIN_VERSION}`,
				'Accept-Encoding': 'gzip,deflate,compress',
			},
			responseType: 'json',
			raxConfig: {
				retry: 3,
				retryDelay: 100,
				httpMethodsToRetry: ['GET', 'PUT'],
				statusCodesToRetry: [
					[100, 199],
					[400, 400],
					[401, 401],
					[404, 405],
					[500, 599],
				],
				backoffType: 'exponential',
				onRetryAttempt: async (err) => {
					const cfg: any = rax.getConfig(err);
					this.platform.log.warn(`${err.message} retrying signin , attempt #${cfg.currentRetryAttempt}`);
				},
			},
		}).catch(err => {
			this.platform.log.debug(JSON.stringify(err, null, 2));
			this.platform.log.error('Error signing in and getting token %s', err.message);
			throw err.code;
		});
		if (response.status === 200) {
			if (this.platform.showAPIMessages) {
				this.platform.log.debug('signin response', JSON.stringify(response.data, null, 2));
			}
			return response.data;
		}
		return response;
	}

	async me(token: any) {
		this.platform.apiCount++;
		this.platform.log.debug('Retrieving my info');
		const response = await axios({
			method: 'get',
			baseURL: userEndpoint,
			url: '/users/me',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
				Partner: 'wallbox',
				'User-Agent': `${PLUGIN_NAME}/${PLUGIN_VERSION}`,
				'Accept-Encoding': 'gzip,deflate,compress',
			},
			responseType: 'json',
		}).catch(err => {
			this.platform.log.debug(JSON.stringify(err, null, 2));
			this.platform.log.error('Error getting my info %s', err.message);
			throw err.code;
		});
		if (response.status === 200) {
			if (this.platform.showAPIMessages) {
				this.platform.log.debug('get me response', JSON.stringify(response.data, null, 2));
			}
			return response.data;
		}
		return response;
	}

	async refresh(refreshToken: any) {
		this.platform.apiCount++;
		this.platform.log.debug('Refreshing token');
		const response = await axios({
			method: 'get',
			baseURL: userEndpoint,
			url: '/users/refresh-token',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${refreshToken}`,
				Partner: 'wallbox',
				'User-Agent': `${PLUGIN_NAME}/${PLUGIN_VERSION}`,
				'Accept-Encoding': 'gzip,deflate,compress',
			},
			responseType: 'json',
			raxConfig: {
				retry: 3,
				retryDelay: 100,
				httpMethodsToRetry: ['GET', 'PUT'],
				statusCodesToRetry: [
					[100, 199],
					[400, 400],
					[404, 404],
					[405, 405],
					[500, 599],
				],
				backoffType: 'exponential',
				onRetryAttempt: async (err) => {
					const cfg: any = rax.getConfig(err);
					this.platform.log.warn(`${err.message} retrying refresh token, attempt #${cfg.currentRetryAttempt}`);
				},
			},
		}).catch(err => {
			this.platform.log.debug(JSON.stringify(err, null, 2));
			this.platform.log.error('Error refreshing token %s', err.message);
			this.platform.log.warn(err.code);
			throw err.code;
		});
		if (response.status === 200) {
			if (this.platform.showAPIMessages) {
				this.platform.log.debug('refresh token response', JSON.stringify(response.data, null, 2));
			}
			return response;
		}
		return response;
	}

	async spaces(token: any) {
		this.platform.apiCount++;
		this.platform.log.debug('Retrieving my info');
		const response = await axios({
			method: 'get',
			baseURL: endpoint,
			url: '/v4/spaces',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
				'User-Agent': `${PLUGIN_NAME}/${PLUGIN_VERSION}`,
				'Accept-Encoding': 'gzip,deflate,compress',
			},
			responseType: 'json',
		}).catch(err => {
			this.platform.log.debug(JSON.stringify(err, null, 2));
			this.platform.log.error('Error getting spaces %s', err.message);
			throw err.code;
		});
		if (response.status === 200) {
			if (this.platform.showAPIMessages) {
				this.platform.log.debug('get spaces response', JSON.stringify(response.data, null, 2));
			}
			return response.data;
		}
		return response;
	}

	async getUserId(token: any, userId: any) { // may not be needed, using user/me
		this.platform.apiCount++;
		this.platform.log.debug('Retrieving id');
		const response = await axios({
			method: 'get',
			baseURL: endpoint,
			url: `/v4/users/${userId}/id`,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
				'User-Agent': `${PLUGIN_NAME}/${PLUGIN_VERSION}`,
				'Accept-Encoding': 'gzip,deflate,compress',
			},
			responseType: 'json',
		}).catch(err => {
			this.platform.log.debug(JSON.stringify(err, null, 2));
			this.platform.log.error('Error getting id %s', err.message);
			throw err.code;
		});
		if (response.status === 200) {
			if (this.platform.showAPIMessages) {
				this.platform.log.debug('get id response', JSON.stringify(response.data, null, 2));
			}
			return response.data;
		}
		return response;
	}

	async getUser(token: any, userId: any) {
		this.platform.apiCount++;
		this.platform.log.debug('Retrieving user info');
		const response = await axios({
			method: 'get',
			baseURL: endpoint,
			url: `/v2/user/${userId}`,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
				'User-Agent': `${PLUGIN_NAME}/${PLUGIN_VERSION}`,
				'Accept-Encoding': 'gzip,deflate,compress',
			},
			responseType: 'json',
		}).catch(err => {
			this.platform.log.debug(JSON.stringify(err, null, 2));
			this.platform.log.error('Error getting user id %s', err.message);
			throw err.code;
		});
		if (response.status === 200) {
			if (this.platform.showAPIMessages) {
				this.platform.log.debug('get user response', JSON.stringify(response.data, null, 2));
			}
			return response.data;
		}
		return response;
	}

	async getChargerGroups(token: any) {
		this.platform.apiCount++;
		this.platform.log.debug('Retrieving charger groups');
		const response = await axios({
			method: 'get',
			baseURL: endpoint,
			url: '/v3/chargers/groups',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
				'User-Agent': `${PLUGIN_NAME}/${PLUGIN_VERSION}`,
				'Accept-Encoding': 'gzip,deflate,compress',
			},
			responseType: 'json',
		}).catch(err => {
			this.platform.log.debug(JSON.stringify(err, null, 2));
			this.platform.log.error('Error getting charger groups %s', err.message);
			throw err.code;
		});
		if (response.status === 200) {
			if (this.platform.showAPIMessages) {
				this.platform.log.debug('get charger groups data response', JSON.stringify(response.data, null, 2));
			}
			return response.data;
		}
		return response;
	}

	async getCharger(token: any, group_id: any) {
		this.platform.apiCount++;
		this.platform.log.debug('Retrieving charger');
		const response = await axios({
			method: 'get',
			baseURL: endpoint,
			url: `/perseus/organizations/${group_id}/chargers`,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
				'User-Agent': `${PLUGIN_NAME}/${PLUGIN_VERSION}`,
				'Accept-Encoding': 'gzip,deflate,compress',
			},
			responseType: 'json',
		}).catch(err => {
			this.platform.log.debug(JSON.stringify(err, null, 2));
			this.platform.log.error('Error getting charger %s', err.message);
			throw err.code;
		});
		if (response.status === 200) {
			if (this.platform.showAPIMessages) {
				this.platform.log.debug('get charger response', JSON.stringify(response.data, null, 2));
			}
			return response.data;
		}
		return response;
	}

	async getChargerStatus(token: any, chargerId: any) {
		this.platform.apiCount++;
		this.platform.log.debug('Retrieving charger status');
		const response = await axios({
			method: 'get',
			baseURL: endpoint,
			url: `/chargers/status/${chargerId}`,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
				'User-Agent': `${PLUGIN_NAME}/${PLUGIN_VERSION}`,
				'Accept-Encoding': 'gzip,deflate,compress',
			},
			responseType: 'json',
			raxConfig: {
				retry: 3,
				//noResponseRetries: 2,
				retryDelay: 100,
				httpMethodsToRetry: ['GET', 'PUT'],
				statusCodesToRetry: [
					[100, 199],
					[400, 400],
					[404, 404],
					[500, 599],
				],
				backoffType: 'exponential',
				onRetryAttempt: async (err) => {
					const cfg: any = rax.getConfig(err);
					this.platform.log.warn(`${err.message} retrying get status, attempt #${cfg.currentRetryAttempt}`);
				},
			},
		}).catch(err => {
			this.platform.log.debug(JSON.stringify(err, null, 2));
			this.platform.log.error('Error getting charger status %s', err.message);
			if(err.response){
				this.platform.log.warn(JSON.stringify(err.response.data, null, 2));
			}
			throw err.code;
		});
		if (response.status === 200) {
			//if(this.platform.showAPIMessages){this.platform.log.debug('get charger status response',JSON.stringify(response.data,null,2))}
			//if (this.platform.showUserMessages){this.platform.log.info('get charger status %s, lock %s',response.data.status_id, response.data.config_data.locked)}
			return response;
		}
		return response;
	}

	async getChargerData(token: any, chargerId: any) {
		this.platform.apiCount++;
		this.platform.log.debug('Retrieving charger data');
		const response = await axios({
			method: 'get',
			baseURL: endpoint,
			url: `/v2/charger/${chargerId}`,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
				'User-Agent': `${PLUGIN_NAME}/${PLUGIN_VERSION}`,
				'Accept-Encoding': 'gzip,deflate,compress',
			},
			responseType: 'json',
		}).catch(err => {
			this.platform.log.debug(JSON.stringify(err, null, 2));
			this.platform.log.error('Error getting charger data %s', err.message);
			if(err.response){
				this.platform.log.warn(JSON.stringify(err.response.data, null, 2));
			}
			throw err.code;
		});
		if (response.status === 200) {
			if (this.platform.showAPIMessages) {
				this.platform.log.debug('get charger data response', JSON.stringify(response.data.data.chargerData, null, 2));
			}
			return response.data.data.chargerData;
		}
		return response;
	}

	async getChargerConfig(token: any, chargerId: any) {
		this.platform.apiCount++;
		this.platform.log.debug('Retrieving charger config');
		const response = await axios({
			method: 'get',
			baseURL: endpoint,
			url: `/chargers/config/${chargerId}`,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
				'User-Agent': `${PLUGIN_NAME}/${PLUGIN_VERSION}`,
				'Accept-Encoding': 'gzip,deflate,compress',
			},
			responseType: 'json',
		}).catch(err => {
			this.platform.log.debug(JSON.stringify(err, null, 2));
			this.platform.log.error('Error getting charger config %s', err.message);
			if(err.response){
				this.platform.log.warn(JSON.stringify(err.response.data, null, 2));
			}
			throw err.code;
		});
		if (response.status === 200) {
			if (this.platform.showAPIMessages) {
				this.platform.log.debug('get charger config response', JSON.stringify(response.data, null, 2));
			}
			return response.data;
		}
		return response;
	}

	async getLastSession(token: any) {
		this.platform.apiCount++;
		this.platform.log.debug('Retrieving charger session');
		const response = await axios({
			method: 'get',
			baseURL: endpoint,
			url: 'v4/charger-last-sessions',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
				'User-Agent': `${PLUGIN_NAME}/${PLUGIN_VERSION}`,
				'Accept-Encoding': 'gzip,deflate,compress',
			},
			responseType: 'json',
		}).catch(err => {
			this.platform.log.debug(JSON.stringify(err, null, 2));
			this.platform.log.error('Error getting charger session %s', err.message);
			throw err.code;
		});
		if (response.status === 200) {
			if (this.platform.showAPIMessages) {
				this.platform.log.debug('get charger session response', JSON.stringify(response.data, null, 2));
			}
			return response.data;
		}
		return response;
	}

	async lock(token: any, chargerId: any, value: any) {
		try {
			this.platform.apiCount++;
			this.platform.log.debug('Setting charger lock state for %s to %s', chargerId, value);
			const response = await axios({
				method: 'put',
				baseURL: endpoint,
				url: `/v2/charger/${chargerId}`,
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
					'User-Agent': `${PLUGIN_NAME}/${PLUGIN_VERSION}`,
					'Accept-Encoding': 'gzip,deflate,br',
				},
				data: {
					locked: value,
				},
				responseType: 'json',
			}).catch(err => {
				this.platform.log.debug(JSON.stringify(err, null, 2));
				this.platform.log.error('Error locking charger config %s', err.message);
				if (err.response) {
					this.platform.log.warn(JSON.stringify(err.response.data, null, 2));
				}
				throw err.code;
			});
			if (response.status && this.platform.showAPIMessages) {
				this.platform.log.debug('put lock response status', response.status);
			}
			if (response.status === 200) {
				if (this.platform.showAPIMessages) {
					this.platform.log.debug('put lock response', JSON.stringify(response.data.data.chargerData, null, 2));
				}
			}
			return response;
		} catch (err) {
			this.platform.log.error('Error setting lock state state \n%s', err);
		}
	}

	async setAmps(token: any, chargerId: any, value: any) {
		this.platform.apiCount++;
		try {
			this.platform.log.debug('Setting amperage for %s to %s', chargerId, value);
			const response = await axios({
				method: 'put',
				baseURL: endpoint,
				url: `/v2/charger/${chargerId}`,
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
					'User-Agent': `${PLUGIN_NAME}/${PLUGIN_VERSION}`,
					'Accept-Encoding': 'gzip,deflate,br',
				},
				data: {
					maxChargingCurrent: value,
				},
				responseType: 'json',
			}).catch(err => {
				this.platform.log.debug(JSON.stringify(err, null, 2));
				this.platform.log.error('Error setting amperage %s', err.message);
				if (err.response) {
					this.platform.log.warn(JSON.stringify(err.response.data, null, 2));
				}
				throw err.code;
			});
			if (response.status && this.platform.showAPIMessages) {
				this.platform.log.debug('put setAmps response status', response.status);
			}
			if (response.status === 200) {
				if (this.platform.showAPIMessages) {
					this.platform.log.debug('put setAmps response {maxChargingCurrent:%s}', JSON.stringify(response.data.data.chargerData.maxChargingCurrent, null, 2));
				}
			}
			return response;
		} catch (err) {
			this.platform.log.error('Error setting amperage \n%s', err);
		}
	}

	async remoteAction(token: any, chargerId: any, value: string) {
		this.platform.apiCount++;
		try {
			this.platform.log.debug('Setting charging state for %s to %s', chargerId, value);
			let action;
			switch (value) {
			case 'start':
				action = 1;
				break;
			case 'resume':
				action = 1;
				break;
			case 'pause':
				action = 2;
				break;
			case 'reboot':
				action = 3;
				break;
			case 'factory reset':
				action = 4;
				break;
			case 'software update':
				action = 5;
				break;
			case 'resume schedule':
				action = 9;
				break;
			}
			const response = await axios({
				method: 'post',
				baseURL: endpoint,
				url: `/v3/chargers/${chargerId}/remote-action`,
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
					'User-Agent': `${PLUGIN_NAME}/${PLUGIN_VERSION}`,
					'Accept-Encoding': 'gzip,deflate,br',
				},
				data: {
					action: action,
				},
				responseType: 'json',
			}).catch(err => {
				this.platform.log.debug(JSON.stringify(err, null, 2));
				this.platform.log.error('Error with remote action %s', err.message);
				if (err.response) {
					this.platform.log.warn(JSON.stringify(err.response.data, null, 2));
				}
				throw err.code;
			});
			if (response.status && this.platform.showAPIMessages) {
				this.platform.log.debug('post remote action response status', response.status);
			}
			if (response.status === 200) {
				if (this.platform.showAPIMessages) {
					this.platform.log.debug('post remote action response', JSON.stringify(response.data, null, 2));
				}
			}
			return response;
		} catch (err) {
			this.platform.log.error('Error with remote action \n%s', err);
		}
	}
}