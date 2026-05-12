/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-fallthrough */

import type { CharacteristicValue, Service, Characteristic } from 'homebridge';
import  wallboxPlatform from '../wallboxplatform.js';

import wallboxAPI from '../wallboxapi.js';

export default class control {
	public readonly Service: typeof Service;
	public readonly Characteristic: typeof Characteristic;
	constructor(
		private readonly platform: wallboxPlatform,
		private wallboxapi = new wallboxAPI(platform),
		private log = platform.log,
	) {
		this.Service = platform.Service;
		this.Characteristic = platform.Characteristic;
	}

	createControlService(device: any, type: string): Service {
		this.log.info('Adding amperage control for %s charger ', device.name);
		this.log.debug('create new control');
		let currentAmps;
		if (this.platform.useFahrenheit) {
			currentAmps = (((device.maxAvailableCurrent - 32 + 0.01) * 5) / 9).toFixed(0);
		} else {
			currentAmps = device.maxAvailableCurrent;
		}
		const controlService = new this.Service.Thermostat(type, device.id);
		controlService
			.addCharacteristic(this.Characteristic.CurrentRelativeHumidity);
		controlService
			.setCharacteristic(this.Characteristic.Name, device.name + ' ' + type)
			.setCharacteristic(this.Characteristic.StatusFault, this.Characteristic.StatusFault.NO_FAULT)
			.setCharacteristic(this.Characteristic.TargetTemperature, currentAmps)
			.setCharacteristic(this.Characteristic.CurrentTemperature, currentAmps)
			.setCharacteristic(this.Characteristic.TemperatureDisplayUnits, this.platform.useFahrenheit);
		return controlService;
	}

	configureControlService(device: any, controlService: Service) {
		let min: any;
		let max: any;
		let step: any;
		if (this.platform.useFahrenheit) {
			min = -14.5;
			max = 4.5;
			step = 0.5;
			if (device.maxAvailableCurrent === 48) {
				max = 9;
			}
		} else {
			min = 6;
			max = 40;
			step = 1;
			if (device.maxAvailableCurrent === 48) {
				max = 48;
			}
		}

		this.log.debug('configured %s control for %s', controlService.getCharacteristic(this.Characteristic.Name).value, device.name);
		controlService.getCharacteristic(this.Characteristic.TargetHeatingCoolingState).setProps({
			minValue: 0,
			maxValue: 1,
			validValues: [0, 1],
		});
		controlService.getCharacteristic(this.Characteristic.TargetHeatingCoolingState)
			.onGet(this.getControlState.bind(this, controlService))
			.onSet(this.setControlState.bind(this, device, controlService));

		controlService.getCharacteristic(this.Characteristic.TargetTemperature)
			.onGet(this.getControlAmps.bind(this, controlService))
			.onSet(this.setControlAmps.bind(this, device, controlService));

		controlService.getCharacteristic(this.Characteristic.TargetTemperature).setProps({
			minValue: min,
			maxValue: max,
			minStep: step,
		});

		controlService.getCharacteristic(this.Characteristic.TemperatureDisplayUnits)
			.onGet(this.getControlUnits.bind(this, controlService))
			.onSet(this.setControlUnits.bind(this, controlService));
	}

	async setControlAmps(device: any, controlService: Service, value: any) {
		let statusCode;
		let currentMode;
		if (controlService.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new  this.platform.HAPStatusError( this.platform.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			controlService.getCharacteristic(this.Characteristic.TargetTemperature).updateValue(value);
			let amps: any;
			if (this.platform.useFahrenheit) {
				amps = (value * 1.8 + 32 + 0.01).toFixed(0);
			} else {
				amps = value;
			}
			const chargerData = await this.wallboxapi.getChargerData(this.platform.token, device.id).catch(err => {
				this.log.error('Failed to get charger data.', err);
			});
			try {
				statusCode = chargerData.status;
				currentMode = this.platform.enumeration.list(statusCode).mode;
				this.log.debug('checking current mode = %s', currentMode);
			} catch (error) {
				statusCode = 'unknown';
				currentMode = 'unknown';
				this.log.error('failed current mode check');
			}
			switch (currentMode) {
			case 'lockedMode':
				switch (statusCode) {
				case 209:
					this.log.info('Car must be connected for this operation');
					controlService.updateCharacteristic(this.Characteristic.TargetTemperature, controlService.getCharacteristic(this.Characteristic.CurrentTemperature).value);
					return;
				case 210:
					this.log.info('Charger must be unlocked for this operation');
					this.log.warn('Car Connected. Unlock charger to start session');
					controlService.updateCharacteristic(this.Characteristic.TargetTemperature, controlService.getCharacteristic(this.Characteristic.CurrentTemperature).value);
					return;
				}
			case 'standbyMode':
				// falls through
			case 'chargingMode':
				this.log.debug('set amps to %s', amps);
				if (controlService.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
					throw new  this.platform.HAPStatusError( this.platform.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
				} else {
					const response = await this.wallboxapi.setAmps(this.platform.token, device.id, amps).catch(err => {
						this.log.error('Failed to set amps.', err);
						return err;
					});
					switch (response.status) {
					case 200:
						controlService.updateCharacteristic(this.Characteristic.CurrentTemperature, controlService.getCharacteristic(this.Characteristic.TargetTemperature).value);
						break;
					default:
						controlService.updateCharacteristic(this.Characteristic.TargetTemperature, controlService.getCharacteristic(this.Characteristic.CurrentTemperature).value);
						this.log.info('Failed to change charging amps %s', response.data.title);
						this.log.debug(response.data);
						break;
					}
				}
				return;
			case 'firmwareUpdate':
				// falls through
			case 'errorMode':
				this.log.info('This opertation cannot be completed at this time, status %s', statusCode);
				this.log.error('the charger %s has a fault condition with code=%s', device.name, statusCode);
				controlService.updateCharacteristic(this.Characteristic.TargetTemperature, controlService.getCharacteristic(this.Characteristic.CurrentTemperature).value);
				return;
			default:
				this.log.info('This opertation cannot be completed at this time, status %s', statusCode);
				controlService.updateCharacteristic(this.Characteristic.TargetTemperature, controlService.getCharacteristic(this.Characteristic.CurrentTemperature).value);
				return;
			}
		}
	}

	async setControlState(device: any, controlService: Service, value: any) {
		let statusCode;
		let currentMode;
		if (controlService.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new  this.platform.HAPStatusError( this.platform.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			controlService.updateCharacteristic(this.Characteristic.TargetHeatingCoolingState, value);
			const chargerData = await this.wallboxapi.getChargerData(this.platform.token, device.id).catch(err => {
				this.log.error('Failed to get charger data.', err);
				return err;
			});
			try {
				statusCode = chargerData.status;
				currentMode = this.platform.enumeration.list(statusCode).mode;
				this.log.debug('checking status code = %s, current mode = %s', statusCode, currentMode);
			} catch (error) {
				currentMode = 'unknown';
				this.log.error('failed current mode check');
			}
			switch (currentMode) {
			case 'lockedMode':
				// falls through
			case 'readyMode':
				if (statusCode === 210) {
					this.log.info('Charger must be unlocked for this operation');
					this.log.warn('Car Connected. Unlock charger to start session');
				} else {
					this.log.info('Car must be connected for this operation');
				}
				controlService.updateCharacteristic(this.Characteristic.TargetHeatingCoolingState, controlService.getCharacteristic(this.Characteristic.CurrentHeatingCoolingState).value);
				return;
			case 'standbyMode':
				this.log.info('Waiting for a charge request');
				if (controlService.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
					throw new  this.platform.HAPStatusError( this.platform.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
				} else {
					const response = await this.wallboxapi.remoteAction(this.platform.token, device.id, 'resume').catch(err => {
						this.log.error('Failed to resume.', err);
						return err;
					});
					switch (response.status) {
					case 200:
						controlService.updateCharacteristic(this.Characteristic.CurrentHeatingCoolingState, controlService.getCharacteristic(this.Characteristic.TargetHeatingCoolingState).value);
						this.log.info('Charging resumed');
						break;
					default:
						controlService.updateCharacteristic(this.Characteristic.TargetHeatingCoolingState, controlService.getCharacteristic(this.Characteristic.CurrentHeatingCoolingState).value);
						this.log.info('Failed to start charging');
						this.log.debug(response.data);
						break;
					}
				}
				return;
			case 'chargingMode':
				this.log.debug('toggle control %s', controlService.getCharacteristic(this.Characteristic.Name).value);
				if (controlService.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
					throw new  this.platform.HAPStatusError( this.platform.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
				} else {
					const response = await this.wallboxapi.remoteAction(this.platform.token, device.id, 'pause').catch(err => {
						this.log.error('Failed to pause.', err);
						return err;
					});
					switch (response.status) {
					case 200:
						controlService.updateCharacteristic(this.Characteristic.CurrentHeatingCoolingState, controlService.getCharacteristic(this.Characteristic.TargetHeatingCoolingState).value);
						this.log.info('Charging paused');
						break;
					default:
						controlService.updateCharacteristic(this.Characteristic.TargetHeatingCoolingState, controlService.getCharacteristic(this.Characteristic.CurrentHeatingCoolingState).value);
						this.log.info('Failed to stop charging');
						this.log.debug(response.data);
						break;
					}
				}
				return;
			case 'firmwareUpdate':
				// falls through
			case 'errorMode':
				this.log.info('This opertation cannot be completed at this time, status %s', statusCode);
				this.log.error('the charger %s has a fault condition with code=%s', device.name, statusCode);
				controlService.updateCharacteristic(this.Characteristic.TargetHeatingCoolingState, controlService.getCharacteristic(this.Characteristic.CurrentHeatingCoolingState).value);
				return controlService.getCharacteristic(this.Characteristic.TargetHeatingCoolingState).value!;
			default:
				this.log.info('This opertation cannot be completed at this time, status %s', statusCode);
				controlService.updateCharacteristic(this.Characteristic.TargetHeatingCoolingState, controlService.getCharacteristic(this.Characteristic.CurrentHeatingCoolingState).value);
				return;
			}
		}
	}

	setControlUnits(controlService: Service, value: any) {
		if (controlService.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new  this.platform.HAPStatusError( this.platform.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			//this.platform.useFahrenheit = value
			controlService.updateCharacteristic(this.Characteristic.TemperatureDisplayUnits, value);
			if (value === 0){
				this.log.debug('change unit value to celsius');
				//controlService.getCharacteristic(this.Characteristic.TargetTemperature).setProps({
				//	minValue: 6,
				//	maxValue: 40,
				//	minStep: 1
				//})
			} else {
				this.log.debug('change unit value to fahrenheit');
				//controlService.getCharacteristic(this.Characteristic.TargetTemperature).setProps({
				//	minValue: -14.5,
				//	maxValue: 4.5,
				//	minStep: 0.5
				//})
			}
			return;
		}
	}

	getControlState(controlService: Service): Promise<CharacteristicValue> {
		if (controlService.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new  this.platform.HAPStatusError( this.platform.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = controlService.getCharacteristic(this.Characteristic.CurrentHeatingCoolingState).value;
			return currentValue;
		}
	}

	getControlAmps(controlService: Service): Promise<CharacteristicValue> {
		if (controlService.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new  this.platform.HAPStatusError( this.platform.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = controlService.getCharacteristic(this.Characteristic.CurrentTemperature).value;
			return currentValue;
		}
	}

	getControlUnits(controlService: Service): Promise<CharacteristicValue> {
		if (controlService.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new  this.platform.HAPStatusError( this.platform.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = controlService.getCharacteristic(this.Characteristic.TemperatureDisplayUnits).value;
			return currentValue;
		}
	}
}
