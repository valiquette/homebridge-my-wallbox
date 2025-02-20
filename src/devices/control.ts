/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-fallthrough */

import type { CharacteristicValue, Service, Characteristic } from 'homebridge';
import { wallboxPlatform } from '../wallboxplatform.js';

import wallboxAPI from '../wallboxapi.js';

export default class control {
	public readonly Service!: typeof Service;
	public readonly Characteristic!: typeof Characteristic;
	constructor(
		private readonly platform: wallboxPlatform,
		private wallboxapi = new wallboxAPI(platform),
	) { }

	createControlService(device: any, type: string): Service {
		this.platform.log.info('Adding amperage control for %s charger ', device.name);
		this.platform.log.debug('create new control');
		let currentAmps;
		if (this.platform.useFahrenheit) {
			currentAmps = (((device.maxAvailableCurrent - 32 + 0.01) * 5) / 9).toFixed(2);
		} else {
			currentAmps = device.maxAvailableCurrent;
		}
		const controlService = new this.platform.Service.Thermostat(type, device.id);
		controlService
			.setCharacteristic(this.platform.Characteristic.Name, device.name + ' ' + type)
			.setCharacteristic(this.platform.Characteristic.StatusFault, this.platform.Characteristic.StatusFault.NO_FAULT)
			.setCharacteristic(this.platform.Characteristic.TargetTemperature, currentAmps)
			.setCharacteristic(this.platform.Characteristic.CurrentTemperature, currentAmps)
			.setCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits, this.platform.useFahrenheit)
			.setCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, 0)
			.setCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState, 0);
		return controlService;
	}

	configureControlService(device: any, controlService: Service) {
		let min;
		let max;
		let step;
		if (this.platform.useFahrenheit) {
			min = -14.5;
			max = 4.5; //4.45
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

		this.platform.log.debug('configured %s control for %s', controlService.getCharacteristic(this.platform.Characteristic.Name).value, device.name);
		controlService
			.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
			.setProps({
				minValue: 0,
				maxValue: 1,
			})
			.onGet(this.getControlState.bind(this, controlService))
			.onSet(this.setControlState.bind(this, device, controlService));
		controlService
			.getCharacteristic(this.platform.Characteristic.TargetTemperature)
			.setProps({
				minValue: min,
				maxValue: max,
				minStep: step,
			})
			.onGet(this.getControlAmps.bind(this, controlService))
			.onSet(this.setControlAmps.bind(this, device, controlService));
		controlService
			.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
			.onGet(this.getControlUnits.bind(this, controlService))
			.onSet(this.setControlUnits.bind(this, device, controlService));
	}

	async setControlAmps(device: any, controlService: Service, value: any) {
		let statusCode;
		let currentMode;
		if (controlService.getCharacteristic(this.platform.Characteristic.StatusFault).value === this.platform.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			controlService.getCharacteristic(this.platform.Characteristic.TargetTemperature).updateValue(value);
			let amps;
			if (this.platform.useFahrenheit) {
				amps = (value * 1.8 + 32 + 0.01).toFixed(2);
			} else {
				amps = value;
			}
			const chargerData = await this.wallboxapi.getChargerData(this.platform.token, device.id).catch(err => {
				this.platform.log.error('Failed to get charger data. \n%s', err);
			});
			try {
				statusCode = chargerData.status;
				currentMode = this.platform.enumeration.list(statusCode).mode;
				this.platform.log.debug('checking current mode = %s', currentMode);
			} catch (error) {
				statusCode = 'unknown';
				currentMode = 'unknown';
				this.platform.log.error('failed current mode check');
			}
			switch (currentMode) {
			case 'lockedMode':
				switch (statusCode) {
				case 209:
					this.platform.log.info('Car must be connected for this operation');
					controlService.updateCharacteristic(this.platform.Characteristic.TargetTemperature, controlService.getCharacteristic(this.platform.Characteristic.CurrentTemperature).value);
					return;
				case 210:
					this.platform.log.info('Charger must be unlocked for this operation');
					this.platform.log.warn('Car Connected. Unlock charger to start session');
					controlService.updateCharacteristic(this.platform.Characteristic.TargetTemperature, controlService.getCharacteristic(this.platform.Characteristic.CurrentTemperature).value);
					return;
				}
			case 'standbyMode':
			case 'chargingMode':
				this.platform.log.debug('set amps to %s', amps);
				if (controlService.getCharacteristic(this.platform.Characteristic.StatusFault).value === this.platform.Characteristic.StatusFault.GENERAL_FAULT) {
					throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
				} else {
					const response = await this.wallboxapi.setAmps(this.platform.token, device.id, amps).catch(err => {
						this.platform.log.error('Failed to set amps. \n%s', err);
					});
					switch (response.status) {
					case 200:
						controlService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, controlService.getCharacteristic(this.platform.Characteristic.TargetTemperature).value);
						break;
					default:
						controlService.updateCharacteristic(this.platform.Characteristic.TargetTemperature, controlService.getCharacteristic(this.platform.Characteristic.CurrentTemperature).value);
						this.platform.log.info('Failed to change charging amps %s', response.data.title);
						this.platform.log.debug(response.data);
						break;
					}
				}
				return controlService.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState).value!;
			case 'firmwareUpdate':
			case 'errorMode':
				this.platform.log.info('This opertation cannot be completed at this time, status %s', statusCode);
				this.platform.log.error('the charger %s has a fault condition with code=%s', device.name, statusCode);
				controlService.updateCharacteristic(this.platform.Characteristic.TargetTemperature, controlService.getCharacteristic(this.platform.Characteristic.CurrentTemperature).value);
				return;
			default:
				this.platform.log.info('This opertation cannot be completed at this time, status %s', statusCode);
				controlService.updateCharacteristic(this.platform.Characteristic.TargetTemperature, controlService.getCharacteristic(this.platform.Characteristic.CurrentTemperature).value);
				return;
			}
		}
	}

	async setControlState(device: any, controlService: Service, value: any) {
		let statusCode;
		let currentMode;
		if (controlService.getCharacteristic(this.platform.Characteristic.StatusFault).value === this.platform.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			controlService.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, value);
			const chargerData = await this.wallboxapi.getChargerData(this.platform.token, device.id).catch(err => {
				this.platform.log.error('Failed to get charger data. \n%s', err);
			});
			try {
				statusCode = chargerData.status;
				currentMode = this.platform.enumeration.list(statusCode).mode;
				this.platform.log.debug('checking status code = %s, current mode = %s', statusCode, currentMode);
			} catch (error) {
				currentMode = 'unknown';
				this.platform.log.error('failed current mode check');
			}
			switch (currentMode) {
			case 'lockedMode':
				// falls through
			case 'readyMode':
				if (statusCode === 210) {
					this.platform.log.info('Charger must be unlocked for this operation');
					this.platform.log.warn('Car Connected. Unlock charger to start session');
				} else {
					this.platform.log.info('Car must be connected for this operation');
				}
				controlService.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, controlService.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState).value);
				return;
			case 'standbyMode':
				this.platform.log.info('Waiting for a charge request');
				if (controlService.getCharacteristic(this.platform.Characteristic.StatusFault).value === this.platform.Characteristic.StatusFault.GENERAL_FAULT) {
					throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
				} else {
					const response = await this.wallboxapi.remoteAction(this.platform.token, device.id, 'resume').catch(err => {
						this.platform.log.error('Failed to resume. \n%s', err);
					});
					switch (response.status) {
					case 200:
						controlService.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState, controlService.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState).value);
						this.platform.log.info('Charging resumed');
						break;
					default:
						controlService.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, controlService.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState).value);
						this.platform.log.info('Failed to start charging');
						this.platform.log.debug(response.data);
						break;
					}
				}
				return;
			case 'chargingMode':
				this.platform.log.debug('toggle control %s', controlService.getCharacteristic(this.platform.Characteristic.Name).value);
				if (controlService.getCharacteristic(this.platform.Characteristic.StatusFault).value === this.platform.Characteristic.StatusFault.GENERAL_FAULT) {
					throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
				} else {
					const response = await this.wallboxapi.remoteAction(this.platform.token, device.id, 'pause').catch(err => {
						this.platform.log.error('Failed to pause. \n%s', err);
					});
					switch (response.status) {
					case 200:
						controlService.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState, controlService.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState).value);
						this.platform.log.info('Charging paused');
						break;
					default:
						controlService.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, controlService.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState).value);
						this.platform.log.info('Failed to stop charging');
						this.platform.log.debug(response.data);
						break;
					}
				}
				return;
			case 'firmwareUpdate':
				// falls through
			case 'errorMode':
				this.platform.log.info('This opertation cannot be completed at this time, status %s', statusCode);
				this.platform.log.error('the charger %s has a fault condition with code=%s', device.name, statusCode);
				controlService.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, controlService.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState).value);
				return controlService.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState).value!;
			default:
				this.platform.log.info('This opertation cannot be completed at this time, status %s', statusCode);
				controlService.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, controlService.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState).value);
				return;
			}
		}
	}

	setControlUnits(device: any, controlService: Service, value: any): Promise<CharacteristicValue> {
		if (controlService.getCharacteristic(this.platform.Characteristic.StatusFault).value === this.platform.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			//this.platform.useFahrenheit=value
			//controlService.updateCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits), value)
			this.platform.log.debug('change unit value to %s', value);
			const currentValue: any = controlService.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits).value;
			return currentValue;
		}
	}

	getControlState(controlService: Service): Promise<CharacteristicValue> {
		if (controlService.getCharacteristic(this.platform.Characteristic.StatusFault).value === this.platform.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = controlService.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState).value;
			return currentValue;
		}
	}

	getControlAmps(controlService: Service): Promise<CharacteristicValue> {
		if (controlService.getCharacteristic(this.platform.Characteristic.StatusFault).value === this.platform.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = controlService.getCharacteristic(this.platform.Characteristic.CurrentTemperature).value;
			return currentValue;
		}
	}

	getControlUnits(controlService: Service): Promise<CharacteristicValue> {
		if (controlService.getCharacteristic(this.platform.Characteristic.StatusFault).value === this.platform.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = controlService.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits).value;
			return currentValue;
		}
	}
}
