/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CharacteristicValue, Service, Characteristic } from 'homebridge';
import  wallboxPlatform from '../wallboxplatform.js';

import wallboxAPI from '../wallboxapi.js';

export default class basicSwitch {
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

	createSwitchService(device: any, type: string): Service {
		this.log.info('Adding switch for %s charger ', device.name);
		this.log.debug('create new switch');
		const switchService = new this.Service.Switch(type, device.id);
		let switchOn = false;
		if (device.statusDescription === 'Charging') {
			switchOn = true;
		}
		switchService
			.setCharacteristic(this.Characteristic.On, switchOn)
			.setCharacteristic(this.Characteristic.Name, device.name + ' ' + type)
			.setCharacteristic(this.Characteristic.StatusFault, false);
		return switchService;
	}

	configureSwitchService(device: any, switchService: Service) {
		this.log.debug('configured %s switch for %s', switchService.getCharacteristic(this.Characteristic.Name).value, device.name);
		switchService.getCharacteristic(this.Characteristic.On)
			.onGet(this.getSwitchValue.bind(this, switchService))
			.onSet(this.setSwitchValue.bind(this, device, switchService));
	}

	async setSwitchValue(device: any, switchService: Service, value: any) {
		let statusCode;
		let currentMode;
		if (switchService.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new  this.platform.HAPStatusError( this.platform.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			switchService.updateCharacteristic(this.Characteristic.On, value);
			const chargerData = await this.wallboxapi.getChargerData(this.platform.token, device.id).catch(err => {
				this.log.error('Failed to get charger data.', err);
			});
			try {
				statusCode = chargerData.status;
				currentMode = this.platform.enumeration.list(statusCode).mode;
				this.log.debug('checking status code = %s, current mode = %s', statusCode, currentMode);
			} catch (error) {
				statusCode = 'unknown';
				currentMode = 'unknown';
				this.log.error('failed current mode check');
			}
			switch (currentMode) {
			case 'lockedMode':
			case 'readyMode':
				if (statusCode === 210) {
					this.log.info('Charger must be unlocked for this operation');
					this.log.warn('Car Connected. Unlock charger to start session');
				} else {
					this.log.info('Car must be connected for this operation');
				}
				switchService.updateCharacteristic(this.Characteristic.On, !value);
				return switchService.getCharacteristic(this.Characteristic.On).value!;
			case 'standbyMode':
				this.log.info('Waiting for a charge request');
				if (switchService.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
					throw new  this.platform.HAPStatusError( this.platform.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
				} else {
					const response = await this.wallboxapi.remoteAction(this.platform.token, device.id, 'resume').catch(err => {
						this.log.error('Failed to resume.', err);
						return err;
					});
					switch (response.status) {
					case 200:
						switchService.updateCharacteristic(this.Characteristic.On, value);
						this.log.info('Charging resumed');
						break;
					default:
						switchService.updateCharacteristic(this.Characteristic.On, !value);
						this.log.info('Failed to start charging');
						this.log.debug(response.data);
						break;
					}
				}
				return switchService.getCharacteristic(this.Characteristic.On).value!;
			case 'chargingMode':
				this.log.debug('toggle switch %s', switchService.getCharacteristic(this.Characteristic.Name).value);
				if (switchService.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
					throw new  this.platform.HAPStatusError( this.platform.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
				} else {
					const response = await this.wallboxapi.remoteAction(this.platform.token, device.id, 'pause').catch(err => {
						this.log.error('Failed to pause.', err);
						return err;
					});
					switch (response.status) {
					case 200:
						switchService.updateCharacteristic(this.Characteristic.On, value);
						this.log.info('Charging paused');
						break;
					default:
						switchService.updateCharacteristic(this.Characteristic.On, !value);
						this.log.info('Failed to stop charging');
						this.log.debug(response.data);
						break;
					}
				}
				return switchService.getCharacteristic(this.Characteristic.On).value!;
			case 'firmwareUpdate':
			case 'errorMode':
				this.log.info('This opertation cannot be completed at this time, status %s', statusCode);
				this.log.error('the charger %s has a fault condition with code=%s', device.name, statusCode);
				switchService.updateCharacteristic(this.Characteristic.On, !value);
				return switchService.getCharacteristic(this.Characteristic.On).value!;
			default:
				this.log.info('This opertation cannot be completed at this time, status %s', statusCode);
				switchService.updateCharacteristic(this.Characteristic.On, !value);
				return switchService.getCharacteristic(this.Characteristic.On).value!;
			}
		}
	}

	getSwitchValue(switchService: Service): Promise<CharacteristicValue> {
		if (switchService.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new  this.platform.HAPStatusError( this.platform.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = switchService.getCharacteristic(this.Characteristic.On).value;
			return currentValue;
		}
	}
}
