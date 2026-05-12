/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CharacteristicValue, PlatformAccessory, Service, Characteristic } from 'homebridge';
import  wallboxPlatform from '../wallboxplatform.js';

import { PLUGIN_VERSION } from '../settings.js';
import wallboxAPI from '../wallboxapi.js';

export default class lock {
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

	createLockAccessory(device: any, config: any, uuid: string, lockAccessory: PlatformAccessory) {
		if (!lockAccessory) {
			this.log.info('Adding lock for %s charger ', device.name);
			this.log.debug('create Lock Accessory %s', device.name);
			lockAccessory = new this.platform.api.platformAccessory(device.name, uuid);
			const lockService = new this.Service.LockMechanism(device.name, device.id);
			lockService.addCharacteristic(this.Characteristic.Identifier);
			lockService.addCharacteristic(this.Characteristic.StatusFault);
			lockService.addCharacteristic(this.Characteristic.OutletInUse);
			lockService.addCharacteristic(this.Characteristic.AccessoryIdentifier);
			lockAccessory.addService(lockService);
		} else {
			this.log.debug('update Lock Accessory %s', device.name);
		}
		lockAccessory.getService(this.Service.AccessoryInformation)!
		  .setCharacteristic(this.Characteristic.Name, device.name)
		  .setCharacteristic(this.Characteristic.Manufacturer, 'Wallbox')
		  .setCharacteristic(this.Characteristic.SerialNumber, device.serialNumber)
		  .setCharacteristic(this.Characteristic.Model, this.platform.model_name)
		  .setCharacteristic(this.Characteristic.Identify, true)
		  .setCharacteristic(this.Characteristic.FirmwareRevision, config.software.currentVersion)
		  .setCharacteristic(this.Characteristic.HardwareRevision, config.part_number)
		  .setCharacteristic(this.Characteristic.SoftwareRevision, PLUGIN_VERSION);

		lockAccessory.getService(this.Service.LockMechanism)!
		  .setCharacteristic(this.Characteristic.Name, device.name)
		  .setCharacteristic(this.Characteristic.Identifier, device.serialNumber)
		  .setCharacteristic(this.Characteristic.StatusFault, this.Characteristic.StatusFault.NO_FAULT)
		  .setCharacteristic(this.Characteristic.OutletInUse, false)
		  .setCharacteristic(this.Characteristic.AccessoryIdentifier, device.uniqueIdentifier);

		return lockAccessory;
	}

	configureLockService(device: any, lockService: Service) {
		this.log.debug('configured %s lock for %s', lockService.getCharacteristic(this.Characteristic.Name).value, device.name);
		lockService.setCharacteristic(this.Characteristic.LockCurrentState, device.locked);
		lockService.setCharacteristic(this.Characteristic.LockTargetState, device.locked);
		lockService.getCharacteristic(this.Characteristic.LockCurrentState)
			.onGet(this.getLockCurrentState.bind(this, device, lockService));
		lockService.getCharacteristic(this.Characteristic.LockTargetState)
			.onGet(this.getLockTargetState.bind(this, lockService))
			.onSet(this.setLockTargetState.bind(this, lockService));

	}

	async getLockCurrentState(device: any, lockService: Service): Promise<CharacteristicValue> {
		this.platform.startLiveUpdate(device);
		const currentValue: any = lockService.getCharacteristic(this.Characteristic.LockCurrentState).value;
		return currentValue;
	}

	async getLockTargetState(lockService: Service): Promise<CharacteristicValue> {
		const currentValue: any = lockService.getCharacteristic(this.Characteristic.LockTargetState).value;
		return currentValue;
	}

	async setLockTargetState(lockService: Service, lockState: any) {
		if (lockService.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new  this.platform.HAPStatusError( this.platform.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			if (lockState === this.Characteristic.LockTargetState.SECURED) {
				this.log.info('Locking %s', lockService.getCharacteristic(this.Characteristic.Name).value);
				const chargerId = lockService.getCharacteristic(this.Characteristic.Identifier).value;
				const response = await this.wallboxapi.lock(this.platform.token, chargerId, lockState).catch((err: any) => {
					this.log.error('Failed to lock.', err);
					return err;
				});
				try {
					switch (response.status) {
					case 200:
						lockService.getCharacteristic(this.Characteristic.LockCurrentState).updateValue(this.Characteristic.LockCurrentState.SECURED);
						break;
					default:
						lockService.getCharacteristic(this.Characteristic.LockTargetState).updateValue(this.Characteristic.LockTargetState.UNSECURED);
						this.log.info('Failed to lock WallBox');
						break;
					}
				} catch (error) {
					this.log.error('Failed to lock Wallbox');
				}
				return;
			}
			if (lockState === this.Characteristic.LockTargetState.UNSECURED) {
				this.log.info('Unlocking %s', lockService.getCharacteristic(this.Characteristic.Name).value);
				const chargerId = lockService.getCharacteristic(this.Characteristic.Identifier).value;
				const response = await this.wallboxapi.lock(this.platform.token, chargerId, lockState).catch((err: any) => {
					this.log.error('Failed to unlock.', err);
					return err;
				});
				try {
					switch (response.status) {
					case 200:
						lockService.getCharacteristic(this.Characteristic.LockCurrentState).updateValue(this.Characteristic.LockCurrentState.UNSECURED);
						break;
					default:
						lockService.getCharacteristic(this.Characteristic.LockTargetState).updateValue(this.Characteristic.LockTargetState.SECURED);
						this.log.info('Failed to unlock WallBox');
						break;
					}
				} catch (error) {
					this.log.error('Failed to unlock Wallbox');
				}
				return;
			}
			return;
		}
	}
}
