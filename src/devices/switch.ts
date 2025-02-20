/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CharacteristicValue, Service, Characteristic } from 'homebridge';
import { wallboxPlatform } from '../wallboxplatform.js';

import wallboxAPI from '../wallboxapi.js';

export default class basicSwitch {
	public readonly Service!: typeof Service;
	public readonly Characteristic!: typeof Characteristic;
	constructor(
		private readonly platform: wallboxPlatform,
		private wallboxapi = new wallboxAPI(this.platform),
	) {}
	createSwitchService(device: any, type: string): Service {
		this.platform.log.info('Adding switch for %s charger ', device.name);
		this.platform.log.debug('create new switch');
		const switchService = new this.platform.Service.Switch(type, device.id);
		let switchOn = false;
		if (device.statusDescription === 'Charging') {
			switchOn = true;
		}
		switchService
			.setCharacteristic(this.platform.Characteristic.On, switchOn)
			.setCharacteristic(this.platform.Characteristic.Name, device.name + ' ' + type)
			.setCharacteristic(this.platform.Characteristic.StatusFault, false);
		return switchService;
	}

	configureSwitchService(device: any, switchService: Service) {
		this.platform.log.debug('configured %s switch for %s', switchService.getCharacteristic(this.platform.Characteristic.Name).value, device.name);
		switchService.getCharacteristic(this.platform.Characteristic.On)
			.onGet(this.getSwitchValue.bind(this, switchService))
			.onSet(this.setSwitchValue.bind(this, device, switchService));
	}

	async setSwitchValue(device: any, switchService: Service, value: any): Promise<CharacteristicValue> {
		let statusCode;
		let currentMode;
		if (switchService.getCharacteristic(this.platform.Characteristic.StatusFault).value === this.platform.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			switchService.updateCharacteristic(this.platform.Characteristic.On, value);
			const chargerData = await this.wallboxapi.getChargerData(this.platform.token, device.id).catch(err => {
				this.platform.log.error('Failed to get charger data. \n%s', err);
			});
			try {
				statusCode = chargerData.status;
				currentMode = this.platform.enumeration.list(statusCode).mode;
				this.platform.log.debug('checking status code = %s, current mode = %s', statusCode, currentMode);
			} catch (error) {
				statusCode = 'unknown';
				currentMode = 'unknown';
				this.platform.log.error('failed current mode check');
			}
			switch (currentMode) {
			case 'lockedMode':
			case 'readyMode':
				if (statusCode === 210) {
					this.platform.log.info('Charger must be unlocked for this operation');
					this.platform.log.warn('Car Connected. Unlock charger to start session');
				} else {
					this.platform.log.info('Car must be connected for this operation');
				}
				switchService.updateCharacteristic(this.platform.Characteristic.On, !value);
				return switchService.getCharacteristic(this.platform.Characteristic.On).value!;
			case 'standbyMode':
				this.platform.log.info('Waiting for a charge request');
				if (switchService.getCharacteristic(this.platform.Characteristic.StatusFault).value === this.platform.Characteristic.StatusFault.GENERAL_FAULT) {
					throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
				} else {
					const response = await this.wallboxapi.remoteAction(this.platform.token, device.id, 'resume').catch(err => {
						this.platform.log.error('Failed to resume. \n%s', err);
					});
					switch (response.status) {
					case 200:
						switchService.updateCharacteristic(this.platform.Characteristic.On, value);
						this.platform.log.info('Charging resumed');
						break;
					default:
						switchService.updateCharacteristic(this.platform.Characteristic.On, !value);
						this.platform.log.info('Failed to start charging');
						this.platform.log.debug(response.data);
						break;
					}
				}
				return switchService.getCharacteristic(this.platform.Characteristic.On).value!;
			case 'chargingMode':
				this.platform.log.debug('toggle switch %s', switchService.getCharacteristic(this.platform.Characteristic.Name).value);
				if (switchService.getCharacteristic(this.platform.Characteristic.StatusFault).value === this.platform.Characteristic.StatusFault.GENERAL_FAULT) {
					throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
				} else {
					const response = await this.wallboxapi.remoteAction(this.platform.token, device.id, 'pause').catch(err => {
						this.platform.log.error('Failed to pause. \n%s', err);
					});
					switch (response.status) {
					case 200:
						switchService.updateCharacteristic(this.platform.Characteristic.On, value);
						this.platform.log.info('Charging paused');
						break;
					default:
						switchService.updateCharacteristic(this.platform.Characteristic.On, !value);
						this.platform.log.info('Failed to stop charging');
						this.platform.log.debug(response.data);
						break;
					}
				}
				return switchService.getCharacteristic(this.platform.Characteristic.On).value!;
			case 'firmwareUpdate':
			case 'errorMode':
				this.platform.log.info('This opertation cannot be completed at this time, status %s', statusCode);
				this.platform.log.error('the charger %s has a fault condition with code=%s', device.name, statusCode);
				switchService.updateCharacteristic(this.platform.Characteristic.On, !value);
				return switchService.getCharacteristic(this.platform.Characteristic.On).value!;
			default:
				this.platform.log.info('This opertation cannot be completed at this time, status %s', statusCode);
				switchService.updateCharacteristic(this.platform.Characteristic.On, !value);
				return switchService.getCharacteristic(this.platform.Characteristic.On).value!;
			}
		}
	}

	getSwitchValue(switchService: Service): Promise<CharacteristicValue> {
		if (switchService.getCharacteristic(this.platform.Characteristic.StatusFault).value === this.platform.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = switchService.getCharacteristic(this.platform.Characteristic.On).value;
			return currentValue;
		}
	}
}
