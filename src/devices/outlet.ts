/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CharacteristicValue, Service, Characteristic } from 'homebridge';
import  wallboxPlatform from '../wallboxplatform.js';

import wallboxAPI from '../wallboxapi.js';

export default class basicOutlet {
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


	createOutletService(device: any, type: string): Service {
		this.log.info('Adding outlet for %s charger ', device.name);
		this.log.debug('create new outlet');
		const outletService = new this.Service.Outlet(type, device.id);
		let outletOn = false;
		if (device.statusDescription === 'Charging') {
			outletOn = true;
		}
		outletService
			.setCharacteristic(this.Characteristic.On, outletOn)
			.setCharacteristic(this.Characteristic.Name, device.name + ' ' + type)
			.setCharacteristic(this.Characteristic.StatusFault, false);
		return outletService;
	}

	configureOutletService(device: any, outletService: Service) {
		this.log.debug('configured %s outlet for %s', outletService.getCharacteristic(this.Characteristic.Name).value, device.name);
		outletService.getCharacteristic(this.Characteristic.On)
			.onGet(this.getOutletValue.bind(this, outletService))
			.onSet(this.setOutletValue.bind(this, device, outletService));
	}

	async setOutletValue(device: any, outletService: Service, value: any) {
		let statusCode;
		let currentMode;
		if (outletService.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new  this.platform.HAPStatusError( this.platform.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			outletService.updateCharacteristic(this.Characteristic.On, value);
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
				outletService.updateCharacteristic(this.Characteristic.On, !value);
				return;
			case 'standbyMode':
				this.log.info('Waiting for a charge request');
				if (outletService.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
					throw new  this.platform.HAPStatusError( this.platform.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
				} else {
					const response = await this.wallboxapi.remoteAction(this.platform.token, device.id, 'resume').catch(err => {
						this.log.error('Failed to resume.', err);
						return err;
					});
					switch (response.status) {
					case 200:
						outletService.updateCharacteristic(this.Characteristic.On, value);
						this.log.info('Charging resumed');
						break;
					default:
						outletService.updateCharacteristic(this.Characteristic.On, !value);
						this.log.info('Failed to start charging');
						this.log.debug(response.data);
						break;
					}
				}
				return;
			case 'chargingMode':
				this.log.debug('toggle outlet %s', outletService.getCharacteristic(this.Characteristic.Name).value);
				if (outletService.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
					throw new  this.platform.HAPStatusError( this.platform.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
				} else {
					const response = await this.wallboxapi.remoteAction(this.platform.token, device.id, 'pause').catch(err => {
						this.log.error('Failed to pause.', err);
						return err;
					});
					switch (response.status) {
					case 200:
						outletService.updateCharacteristic(this.Characteristic.On, value);
						this.log.info('Charging paused');
						break;
					default:
						outletService.updateCharacteristic(this.Characteristic.On, !value);
						this.log.info('Failed to stop charging');
						this.log.debug(response.data);
						break;
					}
				}
				return;
			case 'firmwareUpdate':
			case 'errorMode':
				this.log.info('This opertation cannot be completed at this time, status %s', statusCode);
				this.log.error('the charger %s has a fault condition with code=%s', device.name, statusCode);
				outletService.updateCharacteristic(this.Characteristic.On, !value);
				return;
			default:
				this.log.info('This opertation cannot be completed at this time, status %s', statusCode);
				outletService.updateCharacteristic(this.Characteristic.On, !value);
				return;
			}
		}
	}

	getOutletValue(outletService: Service): Promise<CharacteristicValue> {
		if (outletService.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new  this.platform.HAPStatusError( this.platform.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = outletService.getCharacteristic(this.Characteristic.On).value;
			return currentValue;
		}
	}
}
