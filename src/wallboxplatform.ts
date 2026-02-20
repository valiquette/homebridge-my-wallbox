/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-expressions */

'use strict';

import { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

import wallboxAPI from './wallboxapi.js';
import lock from './devices/lock.js';
import battery from './devices/battery.js';
import sensor from './devices/sensor.js';
import basicSwitch from './devices/switch.js';
import outlet from './devices/outlet.js';
import control from './devices/control.js';
import enumerations from './enumerations.js';


export class wallboxPlatform implements DynamicPlatformPlugin {
	[x: string]: any;
	public readonly Service!: typeof Service;
	public readonly Characteristic!: typeof Characteristic;
	public readonly accessories: PlatformAccessory[] = [];
	constructor(
		public readonly log: Logging,
		public readonly config: PlatformConfig,
		public readonly api: API,
	) {
		this.Service = api.hap.Service;
		this.Characteristic = api.hap.Characteristic;
		this.genUUID = api.hap.uuid.generate;

		this.log.debug('Finished initializing platform:', config.name);

		this.wallboxapi = new wallboxAPI(this);
		this.lock = new lock(this);
		this.battery = new battery(this);
		this.sensor = new sensor(this);
		this.basicSwitch = new basicSwitch(this);
		this.outlet = new outlet(this);
		this.control = new control(this);
		this.enumeration = new enumerations();

		this.timeStamp = new Date();
		this.email = config.email;
		this.password = config.password;
		this.token;
		this.refreshToken;
		this.lastToken;
		this.ttl;
		this.ttlTime;
		this.retryWait = config.retryWait || 60; //sec
		this.retryMax = config.retryMax || 3; //attempts
		this.retryAttempt = 0;
		this.refreshInterval = config.refreshInterval || 24; //hour
		this.liveTimeout = config.liveRefreshTimeout || 2; //min
		this.liveRefresh = config.liveRefreshRate || 20; //sec
		this.lastInterval;
		this.apiCount = 0;
		this.liveUpdate = false;
		this.showBattery = config.cars ? true : false;
		this.showSensor = config.socSensor ? config.socSensor : false;
		this.showControls = config.showControls;
		this.useFahrenheit = config.useFahrenheit ? config.useFahrenheit : true;
		this.showAPIMessages = config.showAPIMessages ? config.showAPIMessages : false;
		this.showUserMessages = config.showUserMessages ? config.showUserMessages : false;
		this.userId;
		this.userUid;
		this.model_name = 'unknown';
		this.cars = config.cars;
		this.locationName = config.locationName;
		this.groupName = config.groupName;
		this.locationMatch;
		this.groupMatch;
		this.accessories = [];
		this.amps = [];
		this.endTime = [];
		if (this.showControls === 8) {
			this.showControls = 4;
			this.useFahrenheit = false;
		}
		if (!config.email || !config.password) {
			this.log.error('Valid email and password are required in order to communicate with wallbox, please check the plugin config');
			return;
		}
		this.log.info('Starting Wallbox platform using homebridge API', api.version);

		api.on('didFinishLaunching', () => {
			log.debug('Executed didFinishLaunching');
			this.getDevices();
		});
	}

	//**
	//** REQUIRED - Homebridge will call the "configureAccessory" method once for every cached accessory restored
	//**

	configureAccessory(accessory: PlatformAccessory) {
		// Added cached devices to the accessories array
		this.log.debug('Found cached accessory %s with %s', accessory.displayName, accessory.services);
		this.accessories.push(accessory);
	}

	identify() {
		this.log.info('Identify wallbox!');
	}

	async getDevices() {
		try {
			this.log.debug('Fetching Build info...');
			this.log.info('Getting Account info...');
			// login to the API and get the token
			const email = await this.wallboxapi.checkEmail(this.email).catch((err: any) => {
				this.log.error('Failed to get email.');
				throw err;
			});
			this.log.info('Email status %s', email.data.attributes.status);
			if (email.data.attributes.status !== 'confirmed') {
				return;
			}

			//get signin & token
			const signin = await this.wallboxapi.signin(this.email, this.password).catch((err: any) => {
				this.log.error('Failed to get signin.');
				throw err;
			});
			this.log.debug('Found user ID %s', signin.data.attributes.user_id);
			this.log.debug('Found token  %s********************%s', signin.data.attributes.token.substring(0, 35), signin.data.attributes.token.substring(signin.data.attributes.token.length - 35));
			this.log.debug('Found refresh token  %s********************%s', signin.data.attributes.refresh_token.substring(0, 35), signin.data.attributes.refresh_token.substring(signin.data.attributes.refresh_token.length - 35));
			this.userUid = signin.data.attributes.user_id;
			this.token = signin.data.attributes.token;
			this.refreshToken = signin.data.attributes.refresh_token;
			this.ttl = signin.data.attributes.ttl;
			this.ttlTime = Math.round((signin.data.attributes.ttl - Date.now()) / 60 / 1000);
			if (this.showUserMessages) {
				this.log.info('Current time ', new Date(Date.now()).toLocaleString());
				this.log.info('Token will expire on %s, %s minutes ', new Date(signin.data.attributes.ttl).toLocaleString(), Math.round((signin.data.attributes.ttl - Date.now()) / 60 / 1000));
				this.log.info('Refresh Token will expire on %s, %s days ', new Date(signin.data.attributes.refresh_token_ttl).toLocaleString(), Math.round((signin.data.attributes.refresh_token_ttl - Date.now()) / 24 / 60 / 60 / 1000));
			} else {
				this.log.debug('Current time ', new Date(Date.now()).toLocaleString());
				this.log.debug('Token will expire on %s, %s minutes ', new Date(signin.data.attributes.ttl).toLocaleString(), Math.round((signin.data.attributes.ttl - Date.now()) / 60 / 1000));
				this.log.debug('Refresh Token will expire on %s, %s days ', new Date(signin.data.attributes.refresh_token_ttl).toLocaleString(), Math.round((signin.data.attributes.refresh_token_ttl - Date.now()) / 24 / 60 / 60 / 1000));
			}

			//get me
			const me = await this.wallboxapi.me(this.token).catch((err: any) => {
				this.log.error('Failed to get my info for build.');
				throw err;
			});
			this.log.debug('Found user id %s', me.data.id);
			this.log.info('Found account for %s %s', me.data.attributes.name, me.data.attributes.surname);
			this.userUid = me.data.id;

			//get groups
			const groups = await this.wallboxapi.getChargerGroups(this.token).catch((err: any) => {
				this.log.error('Failed to get groups for build.');
				throw err;
			});
			groups.result.groups
				.filter((group: { name: any }) => {
					if (!this.groupName || this.groupName === group.name) {
						this.log.info('Found device in the group %s', group.name);
						this.groupMatch = true;
					} else {
						this.log.info('Skipping device at %s, not found at the configured group: %s', group.name, this.groupName);
						this.groupMatch = false;
					}
					return this.groupMatch;
				})
				.forEach((group: { chargers: any[]; uid: any; name: any; }) => {
					//this.log.info('Found group for %s ', group.name)
					group.chargers.forEach(async (charger) => {
						try {
							//get model info
							const chargerInfo = await this.wallboxapi.getCharger(this.token, group.uid).catch((err: any) => {
								this.log.error('Failed to get charger info for build.');
								throw err;
							});
							this.model_name = chargerInfo.data[0].attributes.model_name;
							this.log.info('Found device in location %s', chargerInfo.data[0].attributes.location_name);
							this.log.info('Found charger %s with software %s', charger.name, charger.software.currentVersion);
							if (charger.software.updateAvailable) {
								this.log.warn('%s software update %s is available', charger.name, charger.software.latestVersion);
							}
							this.log.info('Found charger %s with id %s in %s group', charger.name, charger.id, group.name);

							//loop each charger
							const chargerData = await this.wallboxapi.getChargerData(this.token, charger.id).catch((err: any) => {
								this.log.error('Failed to get charger data.');
								throw err;
							});
							const chargerConfig = await this.wallboxapi.getChargerConfig(this.token, charger.id).catch((err: any) => {
								this.log.error('Failed to get charger configs.');
								throw err;
							});

							const uuid: any = this.genUUID(chargerData.uid);
							const index: any = this.accessories.findIndex(accessory => accessory.UUID === uuid);
							let lockAccessory: PlatformAccessory;

							if (!this.accessories[index]) {
								this.log.debug('Registering platform accessory');
								lockAccessory = new lock(this).createLockAccessory(chargerData, chargerConfig, uuid, this.accessories[index]);
								this.accessories.push(lockAccessory);
								this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [lockAccessory]);
							} else {
								this.log.debug('Accessory exists, refreshing');
								lockAccessory= new lock(this).createLockAccessory(chargerData, chargerConfig, uuid, this.accessories[index]);
								//lockAccessory = this.lock.createLockAccessory(chargerData, chargerConfig, uuid, this.accessories[index]);
							}
							const lockService = lockAccessory.getService(this.Service.LockMechanism);
							this.lock.configureLockService(chargerData, lockService);

							if (this.showBattery) {
								const batteryService = this.battery.createBatteryService(chargerData);
								this.battery.configureBatteryService(batteryService);
								const service = lockAccessory.getService(this.Service.Battery);
								if (!service) {
									lockAccessory.addService(batteryService);
									this.api.updatePlatformAccessories([lockAccessory]);
								}
								lockAccessory.getService(this.Service.LockMechanism)!.addLinkedService(batteryService);
								this.amps[batteryService.subtype] = chargerData.maxChgCurrent;
							} else {
								const batteryService = lockAccessory.getService(this.Service.Battery);
								if (batteryService) {
									lockAccessory.removeService(batteryService);
									this.api.updatePlatformAccessories([lockAccessory]);
								}
							}

							if (this.showSensor) {
								const sensorService = this.sensor.createSensorService(chargerData, 'SOC');
								this.sensor.configureSensorService(chargerData, sensorService);
								const service = lockAccessory.getService(this.Service.HumiditySensor);
								if (!service) {
									lockAccessory.addService(sensorService);
									this.api.updatePlatformAccessories([lockAccessory]);
								}
								lockAccessory.getService(this.Service.LockMechanism)!.addLinkedService(sensorService);
							} else {
								const sensorService = lockAccessory.getService(this.Service.HumiditySensor);
								if (sensorService) {
									lockAccessory.removeService(sensorService);
									this.api.updatePlatformAccessories([lockAccessory]);
								}
							}
							// option 4 will display all for development
							if (this.showControls === 5 || this.showControls === 4) {
								const outletService = lockAccessory.getService(this.Service.Outlet);
								if (!outletService) {
									const outletService = this.outlet.createOutletService(chargerData, 'Charging');
									this.outlet.configureOutletService(chargerData, outletService);
									lockAccessory.addService(outletService);
									this.api.updatePlatformAccessories([lockAccessory]);
								} else {
									this.outlet.configureOutletService(chargerData, outletService);
									this.api.updatePlatformAccessories([lockAccessory]);
								}
							} else {
								const outletService = lockAccessory.getService(this.Service.Outlet);
								if (outletService) {
									lockAccessory.removeService(outletService);
									this.api.updatePlatformAccessories([lockAccessory]);
								}
							}

							if (this.showControls === 3 || this.showControls === 4) {
								const controlService = lockAccessory.getService(this.Service.Thermostat);
								if (!controlService) {
									const controlService = this.control.createControlService(chargerData, 'Charging Amps');
									this.control.configureControlService(chargerData, controlService);
									lockAccessory.addService(controlService);
									this.api.updatePlatformAccessories([lockAccessory]);
								} else {
									this.control.configureControlService(chargerData, controlService);
									this.api.updatePlatformAccessories([lockAccessory]);
								}
							} else {
								const controlService = lockAccessory.getService(this.Service.Thermostat);
								if (controlService) {
									lockAccessory.removeService(controlService);
									this.api.updatePlatformAccessories([lockAccessory]);
								}
							}

							if (this.showControls === 1 || this.showControls === 4) {
								const switchService = lockAccessory.getService(this.Service.Switch);
								if (!switchService) {
									const switchService = this.basicSwitch.createSwitchService(chargerData, 'Charging');
									this.basicSwitch.configureSwitchService(chargerData, switchService);
									lockAccessory.addService(switchService);
									lockAccessory.getService(this.Service.LockMechanism)!.addLinkedService(switchService);
								} else {
									this.basicSwitch.configureSwitchService(chargerData, switchService);
									this.api.updatePlatformAccessories([lockAccessory]);
								}
							} else {
								const service = lockAccessory.getService(this.Service.Switch);
								if (service) {
									lockAccessory.removeService(service);
									this.api.updatePlatformAccessories([lockAccessory]);
								}
							}

							this.setChargerRefresh(chargerData);
							this.getStatus(chargerData.id);
						} catch (err: any) {
							this.log.error(err);
							return err;
						}
					});
				});
			setTimeout(() => {
				this.log.success('Wallbox platform finished loading');
			}, 2500);
		} catch (err: any) {
			if (this.retryAttempt < this.retryMax) {
				this.retryAttempt++;
				this.log.error('Failed to get device "%s". Retry attempt %s of %s in %s seconds...', err, this.retryAttempt, this.retryMax, this.retryWait);
				setTimeout(async () => {
					this.getDevices();
				}, this.retryWait * 1000);
			} else {
				this.log.error('Failed to get devices...\n%s', err);
			}
		}
	}

	async getNewToken(token: any) {
		try {
			const refresh = await this.wallboxapi.refresh(token).catch((err: any) => {
				this.log.error('Failed to refresh token.');
				throw err;
			});
			if (refresh.status === 200) {
				if (this.showUserMessages) {
					this.log.info('Updated token  %s********************%s', refresh.data.data.attributes.token.substring(0, 35), refresh.data.data.attributes.token.substring(refresh.data.data.attributes.token.length - 35));
					this.log.info(
						'Updated refresh token  %s********************%s',
						refresh.data.data.attributes.refresh_token.substring(0, 35),
						refresh.data.data.attributes.refresh_token.substring(refresh.data.data.attributes.refresh_token.length - 35),
					);
				} else {
					this.log.debug('Updated token  %s********************%s', refresh.data.data.attributes.token.substring(0, 35), refresh.data.data.attributes.token.substring(refresh.data.data.attributes.token.length - 35));
					this.log.debug(
						'Updated refresh token  %s********************%s',
						refresh.data.data.attributes.refresh_token.substring(0, 35),
						refresh.data.data.attributes.refresh_token.substring(refresh.data.data.attributes.refresh_token.length - 35),
					);
				}
				this.userUid = refresh.data.data.attributes.user_id;
				this.token = refresh.data.data.attributes.token;
				this.refreshToken = refresh.data.data.attributes.refresh_token;
				this.ttl = refresh.data.data.attributes.ttl;
				this.ttlTime = Math.round((refresh.data.data.attributes.ttl - Date.now()) / 60 / 1000);
				return 'Refreshed exsisting token';
			}
			if (refresh.status === 401) {
				const signin = await this.wallboxapi.signin(this.email, this.password).catch((err: any) => {
					this.log.error('Failed to get signin and get new token.');
					throw err;
				});
				if (this.showUserMessages) {
					this.log.info('New token %s********************%s', signin.data.attributes.token.substring(0, 35), signin.data.attributes.token.substring(signin.data.attributes.token.length - 35));
					this.log.info('New refresh token  %s********************%s', signin.data.attributes.refresh_token.substring(0, 35), signin.data.attributes.refresh_token.substring(signin.data.attributes.refresh_token.length - 35));
				} else {
					this.log.debug('New token  %s********************%s', signin.data.attributes.token.substring(0, 35), signin.data.attributes.token.substring(signin.data.attributes.token.length - 35));
					this.log.debug('New refresh token  %s********************%s', signin.data.attributes.refresh_token.substring(0, 35), signin.data.attributes.refresh_token.substring(signin.data.attributes.refresh_token.length - 35));
				}
				this.userUid = signin.data.attributes.user_id;
				this.token = signin.data.attributes.token;
				this.refreshToken = signin.data.attributes.refresh_token;
				this.ttl = signin.data.attributes.ttl;
				this.ttlTime = Math.round((signin.data.attributes.ttl - Date.now()) / 60 / 1000);
				return 'Refreshed token';
			}
			return 'Failed to refresh token';
		} catch (err) {
			this.log.error('Failed to refresh token', err);
		}
	}

	setChargerRefresh(device: any) {
		// Refresh charger status
		setInterval(async () => {
			await this.getNewToken(this.refreshToken);
			this.log('API calls for this polling period %s', this.apiCount);
			this.apiCount = 0;
			this.getStatus(device.id);
			try {
				const checkUpdate = await this.wallboxapi.getChargerConfig(this.token, device.id).catch((err: any) => {
					this.log.error('Failed to refresh charger configs.');
					throw err;
				});
				if (checkUpdate.software.updateAvailable) {
					this.log.warn('%s software update %s is available', checkUpdate.name, checkUpdate.software.latestVersion);
				}
			} catch (err) {
				this.log.error('Error checking for update. \n%s', err);
			}
		}, this.refreshInterval * 60 * 60 * 1000);
	}

	async startLiveUpdate(device: any) {
		//check for duplicate call
		const delta: any = new Date().valueOf() - this.timeStamp;
		if (delta > 500) {
			//calls within 1/2 sec will be skipped as duplicate
			this.timeStamp = new Date();
		} else {
			this.log.debug('Skipped new live update due to duplicate call, timestamp delta %s ms', delta);
			return;
		}
		clearInterval(this.lastInterval);
		//get new token
		const x: any = await this.getNewToken(this.refreshToken);
		if ((this, this.showUserMessages)) {
			this.log.info('Starting live update');
			this.log.info(x);
		} else {
			this.log.debug('Starting live update');
			this.log.debug(x);
		}
		this.liveUpdate = true;
		const startTime = new Date().getTime(); //live refresh start time
		if (!this.liveUpdate) {
			this.log.debug('Live update started');
		}
		this.liveUpdate = true;
		const interval = setInterval(async () => {
			if (new Date().getTime() - startTime > this.liveTimeout * 60 * 1000) {
				clearInterval(interval);
				this.liveUpdate = false;
				if (this.showUserMessages) {
					this.log.info('Live update stopped');
				} else {
					this.log.debug('Live update stopped');
				}
				return;
			}
			this.getStatus(device.id);
			this.log.debug('API call count %s', this.apiCount);
		}, this.liveRefresh * 1000);
		this.lastInterval = interval;
	}

	calcBattery(batteryService: Service, energyAdded: any, chargingTime: any) {
		const wallboxChargerName = batteryService.getCharacteristic(this.Characteristic.Name).value;
		try {
			if (this.cars) {
				const car = this.cars.filter((charger: any) => charger.chargerName === wallboxChargerName);
				if (car[0]) {
					this.batterySize = car[0].kwH;
				} else {
					this.log.warn('Unable to find charger named "%s" as configured in the plugin settings for car "%s" with charger "%s". Please check your plugin settings.', wallboxChargerName, this.cars[0].carName, this.cars[0].chargerName);
				}
			}
		} catch (err) {
			this.log.error('Error with config. \n%s', JSON.stringify(this.cars, null, 2));
		}

		if (!this.batterySize) {
			this.batterySize = 80;
		}
		const hours = Math.floor(chargingTime / 60 / 60);
		const minutes = Math.floor(chargingTime / 60) - hours * 60;
		//const seconds = chargingTime % 60;
		const percentAdded = Math.round((energyAdded / this.batterySize) * 100);
		this.log.debug('Charging time %s hours %s minutes, charge added %s kWh, %s%', hours, minutes, energyAdded, percentAdded);
		return percentAdded;
	}

	async getStatus(id: any) {
		try {
			const statusResponse = await this.wallboxapi.getChargerStatus(this.token, id).catch((err: any) => {
				this.log.error('Failed to update charger status.');
				throw err;
			});

			this.log.debug('response status %s', statusResponse.status);
			if (statusResponse.status === 200) {
				this.updateStatus(statusResponse.data);
			}
		} catch (err) {
			this.log.error('Error updating status. %s', err);
		}
		return;
	}

	async updateStatus(charger: any) {
		try {
			const chargerID = charger.config_data.charger_id;
			const chargerUID = charger.config_data.uid;
			const lockState = charger.config_data.locked;
			const maxAmps = charger.config_data.max_charging_current;
			const chargerName = charger.name;
			const statusID = charger.status_id;
			const added_kWh = charger.added_energy;
			const chargingTime = charger.charging_time;
			const uuid = this.genUUID(chargerUID);
			const index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
			const lockAccessory = this.accessories[index];
			let controlService: any = null;
			let switchService: any = null;
			let outletService: any = null;
			let lockService: any = null;
			let batteryService: any = null;
			let sensorService: any = null;
			let statusInfo: any = null;
			let batteryPercent: any = null;
			this.log.debug('Updating charger ID %s', chargerID);
			lockService = lockAccessory.getServiceById(this.Service.LockMechanism, chargerID);
			if (this.showBattery) {
				batteryService = lockAccessory.getServiceById(this.Service.Battery, chargerID);
				batteryPercent = this.calcBattery(batteryService, added_kWh, chargingTime);
				if (this.showSensor) {
					sensorService = lockAccessory.getServiceById(this.Service.HumiditySensor, chargerID);
				}
			}
			if (this.showControls === 1 || this.showControls === 4) {
				switchService = lockAccessory.getServiceById(this.Service.Switch, chargerID);
			}
			if (this.showControls === 5 || this.showControls === 4) {
				outletService = lockAccessory.getServiceById(this.Service.Outlet, chargerID);
			}
			if (this.showControls === 3 || this.showControls === 4) {
				controlService = lockAccessory.getServiceById(this.Service.Thermostat, chargerID);
			}
			/****
			enumerations will contain list of known status and descriptions
			text is base on web, altText is based on app
			statusDescipton is base on observered response or past API statusDescription
			****/
			try {
				statusInfo = this.enumeration.list(statusID);
				this.log.debug('Refreshed charger with status=%s %s - %s. %s.', statusID, statusInfo.statusDescription, statusInfo.text, statusInfo.altText);
			} catch (err) {
				statusInfo.mode = 'unknown';
			}
			switch (statusInfo.mode) {
			case 'lockedMode':
				// falls through
			case 'readyMode':
				if (lockService.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
					this.log.info('%s charger online at %s! The connection was restored.',
						chargerName, new Date(charger.config_data.sync_timestamp * 1000).toLocaleString());
				}
				lockService.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
				if (charger.statusID === 210) {
					lockService.getCharacteristic(this.Characteristic.OutletInUse).updateValue(true);
				} else {
					lockService.getCharacteristic(this.Characteristic.OutletInUse).updateValue(false);
				}
				lockService.getCharacteristic(this.Characteristic.LockCurrentState).updateValue(lockState);
				lockService.getCharacteristic(this.Characteristic.LockTargetState).updateValue(lockState);
				if (this.showControls === 1 || this.showControls === 4) {
					switchService.getCharacteristic(this.Characteristic.On).updateValue(false);
				}
				if (this.showControls === 5 || this.showControls === 4) {
					outletService.getCharacteristic(this.Characteristic.On).updateValue(false);
				}
				if (this.showControls === 3 || this.showControls === 4) {
					controlService.getCharacteristic(this.Characteristic.CurrentHeatingCoolingState).updateValue(false);
					controlService.getCharacteristic(this.Characteristic.TargetHeatingCoolingState).updateValue(false);
					controlService.getCharacteristic(this.Characteristic.CurrentRelativeHumidity).updateValue(batteryPercent);
					if (this.useFahrenheit) {
						controlService.getCharacteristic(this.Characteristic.CurrentTemperature).updateValue((((maxAmps - 32 + 0.01) * 5) / 9).toFixed(0));
						controlService.getCharacteristic(this.Characteristic.TargetTemperature).updateValue((((maxAmps - 32 + 0.01) * 5) / 9).toFixed(0));
					} else {
						controlService.getCharacteristic(this.Characteristic.CurrentTemperature).updateValue(maxAmps);
						controlService.getCharacteristic(this.Characteristic.TargetTemperature).updateValue(maxAmps);
					}
				}
				if (this.showBattery) {
					batteryService.getCharacteristic(this.Characteristic.ChargingState).updateValue(this.Characteristic.ChargingState.NOT_CHARGING);
					batteryService.getCharacteristic(this.Characteristic.BatteryLevel).updateValue(batteryPercent);
					if (this.showSensor) {
						sensorService.getCharacteristic(this.Characteristic.CurrentRelativeHumidity).updateValue(batteryPercent);
					}
				}
				break;
			case 'chargingMode':
				if (lockService.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
					this.log.info('%s charger online at %s! The connection was restored.',
						chargerName, new Date(charger.config_data.sync_timestamp * 1000).toLocaleString());
				}
				lockService.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
				lockService.getCharacteristic(this.Characteristic.OutletInUse).updateValue(true);
				lockService.getCharacteristic(this.Characteristic.LockCurrentState).updateValue(lockState);
				lockService.getCharacteristic(this.Characteristic.LockTargetState).updateValue(lockState);
				if (this.showControls === 1 || this.showControls === 4) {
					switchService.getCharacteristic(this.Characteristic.On).updateValue(true);
				}
				if (this.showControls === 5 || this.showControls === 4) {
					outletService.getCharacteristic(this.Characteristic.On).updateValue(true);
				}
				if (this.showControls === 3 || this.showControls === 4) {
					controlService.getCharacteristic(this.Characteristic.CurrentHeatingCoolingState).updateValue(true);
					controlService.getCharacteristic(this.Characteristic.TargetHeatingCoolingState).updateValue(true);
					controlService.getCharacteristic(this.Characteristic.CurrentRelativeHumidity).updateValue(batteryPercent);
					if (this.useFahrenheit) {
						controlService.getCharacteristic(this.Characteristic.CurrentTemperature).updateValue((((maxAmps - 32 + 0.01) * 5) / 9).toFixed(0));
						controlService.getCharacteristic(this.Characteristic.TargetTemperature).updateValue((((maxAmps - 32 + 0.01) * 5) / 9).toFixed(0));
					} else {
						controlService.getCharacteristic(this.Characteristic.CurrentTemperature).updateValue(maxAmps);
						controlService.getCharacteristic(this.Characteristic.TargetTemperature).updateValue(maxAmps);
					}
				}
				if (this.showBattery) {
					batteryService.getCharacteristic(this.Characteristic.ChargingState).updateValue(this.Characteristic.ChargingState.CHARGING);
					batteryService.getCharacteristic(this.Characteristic.BatteryLevel).updateValue(this.calcBattery(batteryService, added_kWh, chargingTime));
					if (this.showSensor) {
						sensorService.getCharacteristic(this.Characteristic.CurrentRelativeHumidity).updateValue(batteryPercent);
					}
				}
				break;
			case 'standbyMode':
				if (lockService.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
					this.log.info('%s charger online at %s! The connection was restored.',
						chargerName, new Date(charger.config_data.sync_timestamp * 1000).toLocaleString());
				}
				lockService.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
				lockService.getCharacteristic(this.Characteristic.OutletInUse).updateValue(true);
				lockService.getCharacteristic(this.Characteristic.LockCurrentState).updateValue(lockState);
				lockService.getCharacteristic(this.Characteristic.LockTargetState).updateValue(lockState);
				if (this.showControls === 1 || this.showControls === 4) {
					switchService.getCharacteristic(this.Characteristic.On).updateValue(false);
				}
				if (this.showControls === 5 || this.showControls === 4) {
					outletService.getCharacteristic(this.Characteristic.On).updateValue(false);
				}
				if (this.showControls === 3 || this.showControls === 4) {
					controlService.getCharacteristic(this.Characteristic.CurrentHeatingCoolingState).updateValue(false);
					controlService.getCharacteristic(this.Characteristic.TargetHeatingCoolingState).updateValue(false);
					controlService.getCharacteristic(this.Characteristic.CurrentRelativeHumidity).updateValue(batteryPercent);
					if (this.useFahrenheit) {
						controlService.getCharacteristic(this.Characteristic.CurrentTemperature).updateValue((((maxAmps - 32 + 0.01) * 5) / 9).toFixed(0));
						controlService.getCharacteristic(this.Characteristic.TargetTemperature).updateValue((((maxAmps - 32 + 0.01) * 5) / 9).toFixed(0));
					} else {
						controlService.getCharacteristic(this.Characteristic.CurrentTemperature).updateValue(maxAmps);
						controlService.getCharacteristic(this.Characteristic.TargetTemperature).updateValue(maxAmps);
					}
				}
				if (this.showBattery) {
					batteryService.getCharacteristic(this.Characteristic.ChargingState).updateValue(this.Characteristic.ChargingState.NOT_CHARGING);
					batteryService.getCharacteristic(this.Characteristic.BatteryLevel).updateValue(this.calcBattery(batteryService, added_kWh, chargingTime));
					if (this.showSensor) {
						sensorService.getCharacteristic(this.Characteristic.CurrentRelativeHumidity).updateValue(batteryPercent);
					}
				}
				if (statusID === 4) {
					this.log.info('%s completed at %s', chargerName, new Date().toLocaleString());
				}
				break;
			case 'firmwareUpdate':
			case 'errorMode':
				lockService.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
				switch (statusID) {
				case 166: //Updating':
					this.log.info('%s updating...', chargerName);
					break;
				case 14: //error':
				case 15:
					this.log.error('%s threw an error at %s!', chargerName, Date().toLocaleString());
					break;
				case 5: //Offline':
					this.log.warn('%s charger offline at %s! This will show as non-responding in Homekit until the connection is restored.',
						chargerName, new Date(charger.config_data.sync_timestamp * 1000).toLocaleString());
					break;
				case 0: //'Dissconnected':
					this.log.warn('%s disconnected at %s! This will show as non-responding in Homekit until the connection is restored.',
						chargerName, new Date(charger.config_data.sync_timestamp * 1000).toLocaleString());
					break;
				}
				break;
			default:
				this.log.warn('Unknown device status received: %s: %s', statusID);
				break;
			}
			return charger;
		} catch (err) {
			this.log.error('Error updating status %s', err);
		}
	}
}
